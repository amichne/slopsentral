from __future__ import annotations

import hashlib
import io
import json
import os
import pty
import select
import shlex
import shutil
import signal
import subprocess
import sys
import tarfile
import termios
import time
from pathlib import Path

import pytest

from tools import slopsentral as cli

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "tools/slopsentral.py"


def invoke(home: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=home,
        env={**os.environ, "HOME": str(home), "XDG_DATA_HOME": str(home / "data")},
        capture_output=True,
        text=True,
        check=False,
    )


def test_public_help_and_explicit_host(tmp_path: Path) -> None:
    result = invoke(tmp_path, "--help")
    assert result.returncode == 0, result.stderr
    for command in ["install", "update", "remove", "self", "kotlin-horizontalization"]:
        assert command in result.stdout
    rejected = invoke(tmp_path, "install")
    assert rejected.returncode == 2
    assert "--host" in rejected.stderr
    assert not (tmp_path / "data").exists()


def test_installed_horizontalization_is_offline_and_advisory(tmp_path: Path) -> None:
    assert invoke(tmp_path, "self", "install").returncode == 0
    repo = tmp_path / "Kotlin project ; literal"
    package = repo / "src/main/kotlin/example"
    package.mkdir(parents=True)
    names = ("Apple", "Birch", "Cedar", "Dogwood", "Elm", "Fir", "Gum", "Hazel")
    for name in names:
        _ = (package / f"{name}.kt").write_text(f"class {name}\n")
    before = {p: p.read_bytes() for p in package.iterdir()}
    environment = {
        **os.environ,
        "HOME": str(tmp_path),
        "XDG_DATA_HOME": str(tmp_path / "data"),
        "UV_CACHE_DIR": str(tmp_path / "uv-cache"),
        "PATH": str(tmp_path / ".local/bin") + os.pathsep + os.environ["PATH"],
    }
    # Prepare the pinned runtime before the offline operation, including fzf.
    ready = subprocess.run(
        ["slopsentral", "--help"],
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert ready.returncode == 0, ready.stdout + ready.stderr
    environment["UV_OFFLINE"] = "1"

    def audit(*args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["slopsentral", "kotlin-horizontalization", "--repo", str(repo), *args],
            cwd=tmp_path,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )

    result = audit("--all")
    assert result.returncode == 0, result.stdout + result.stderr
    report = json.loads(result.stdout)
    assert report["status"] == "advisory"
    assert report["findings"] == [
        {
            "severity": "concern",
            "path": "src/main/kotlin/example",
            "message": "package directory has 8 or more direct Kotlin files",
            "evidence": {"directKotlinFiles": 8},
        }
    ]
    assert {p: p.read_bytes() for p in package.iterdir()} == before
    assert json.loads(audit("--all", "--summary").stdout)["findingCount"] == 1
    assert "8 or more" in audit("--all", "--format", "text").stdout
    for name in names[3:]:
        (package / f"{name}.kt").unlink()
    assert json.loads(audit("--all").stdout)["findings"] == []
    # The helper is a shipped file, not an import from the checkout.
    assert (
        len(list((tmp_path / "data/slopsentral/command").glob("*/kotlin-horizontalization-check")))
        == 1
    )
    assert invoke(tmp_path, "self", "remove").returncode == 0


@pytest.mark.parametrize("mode", ["repo", "list", "outside", "git"])
def test_horizontalization_rejects_incomplete_inspection(tmp_path: Path, mode: str) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    outside = tmp_path / "src/main/kotlin/Outside.kt"
    outside.parent.mkdir(parents=True)
    _ = outside.write_text("class Outside\n")
    arguments = {
        "repo": ["--repo", str(repo / "absent"), "--all"],
        "list": ["--repo", str(repo), "--changed-files-file", "absent.txt"],
        "outside": ["--repo", str(repo), "--changed-file", str(outside)],
        "git": ["--repo", str(repo)],
    }[mode]
    result = invoke(tmp_path, "kotlin-horizontalization", *arguments)
    assert result.returncode != 0
    assert json.loads(result.stdout)["reason"] == "INSPECTION_FAILED"
    assert not (tmp_path / "data").exists()


def test_horizontalization_discovers_changes_and_preserves_explicit_scope(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    _ = subprocess.run(["git", "init", "-q", str(repo)], check=True)
    package = repo / "src/test/kotlin/example"
    package.mkdir(parents=True)
    for name in ("OrderReader", "OrderWriter", "OrderStore"):
        _ = (package / f"{name}.kt").write_text(f"class {name}\n")
    result = invoke(tmp_path, "kotlin-horizontalization", "--repo", str(repo))
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout)["findings"][0]["evidence"]["prefix"] == "Order"
    paths = repo / "changes.txt"
    _ = paths.write_text("README.md\n")
    explicit = invoke(
        tmp_path,
        "kotlin-horizontalization",
        "--repo",
        str(repo),
        "--changed-files-file",
        str(paths),
    )
    assert explicit.returncode == 0, explicit.stdout + explicit.stderr
    assert json.loads(explicit.stdout)["findings"] == []
    _ = paths.write_text("")
    empty = invoke(
        tmp_path,
        "kotlin-horizontalization",
        "--repo",
        str(repo),
        "--changed-files-file",
        str(paths),
    )
    assert empty.returncode == 0, empty.stdout + empty.stderr
    assert json.loads(empty.stdout)["findings"] == []


def test_horizontalization_preserves_edited_installed_helper(tmp_path: Path) -> None:
    assert invoke(tmp_path, "self", "install").returncode == 0
    helper = next((tmp_path / "data/slopsentral/command").glob("*/kotlin-horizontalization-check"))
    _ = helper.write_text("edited helper\n")
    removed = invoke(tmp_path, "self", "remove")
    assert removed.returncode == 1
    assert json.loads(removed.stdout)["reason"] == "OWNERSHIP_CONFLICT"
    assert helper.read_text() == "edited helper\n"


def test_old_two_file_command_reports_missing_helper_and_recovers(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # An older self-update downloads only the new entry point and its lock.
    directory = tmp_path / "data/slopsentral/command"
    standalone = directory / "old-copy"
    standalone.mkdir(parents=True)
    script = standalone / "slopsentral.py"
    _ = shutil.copyfile(SCRIPT, script)
    _ = shutil.copyfile(Path(str(SCRIPT) + ".lock"), Path(str(script) + ".lock"))
    result = subprocess.run(
        [sys.executable, str(script), "kotlin-horizontalization", "--all"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "NOT_INSTALLED"
    assert "slopsentral self update" in json.loads(result.stdout)["detail"]
    missing_audit = subprocess.run(
        [sys.executable, str(script), "audit", "--help"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert missing_audit.returncode == 1
    assert "slopsentral self update" in missing_audit.stderr
    executable = tmp_path / ".local/bin/slopsentral"
    executable.parent.mkdir(parents=True)
    launcher = f'#!/bin/sh\nexec {shlex.quote(sys.executable)} {shlex.quote(str(script))} "$@"\n'
    _ = executable.write_text(launcher)
    executable.chmod(0o755)
    files = {
        p.relative_to(directory).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in standalone.iterdir()
    }
    _ = (directory / "receipt.json").write_text(json.dumps({"files": files, "launcher": launcher}))
    _ = release_fixture(
        tmp_path,
        {
            "slopsentral.py": SCRIPT.read_bytes(),
            "slopsentral.py.lock": Path(str(SCRIPT) + ".lock").read_bytes(),
            "kotlin-horizontalization-check": (
                ROOT / "source/hooks/kotlin-horizontalization-check"
            ).read_bytes(),
            "kotlin-horizontalization-check.lock": (
                ROOT / "source/hooks/kotlin-horizontalization-check.lock"
            ).read_bytes(),
        },
    )
    environment = {
        **os.environ,
        "HOME": str(tmp_path),
        "XDG_DATA_HOME": str(tmp_path / "data"),
        "UV_CACHE_DIR": str(tmp_path / "uv-cache"),
        "PATH": str(tmp_path / "bin") + os.pathsep + os.environ["PATH"],
    }
    monkeypatch.setenv("PATH", environment["PATH"])
    updated = subprocess.run(
        [str(executable), "self", "update"],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert updated.returncode == 0, updated.stdout + updated.stderr
    ready = subprocess.run(
        [str(executable), "--help"],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert ready.returncode == 0, ready.stdout + ready.stderr
    audit = subprocess.run(
        [str(executable), "kotlin-horizontalization", "--repo", str(tmp_path), "--all"],
        env={**environment, "UV_OFFLINE": "1"},
        capture_output=True,
        text=True,
        check=False,
    )
    assert audit.returncode == 0, audit.stdout + audit.stderr
    assert json.loads(audit.stdout)["status"] == "advisory"


def test_command_install_repeat_remove_and_foreign_file(tmp_path: Path) -> None:
    installed = invoke(tmp_path, "self", "install")
    assert installed.returncode == 0, installed.stdout + installed.stderr
    executable = tmp_path / ".local/bin/slopsentral"
    assert executable.is_file()
    result = subprocess.run(
        [str(executable), "--help"], capture_output=True, text=True, check=False
    )
    assert result.returncode == 0, result.stderr
    assert "--host" not in result.stderr
    assert invoke(tmp_path, "self", "install").returncode == 0
    _ = executable.write_text("foreign command\n")
    assert invoke(tmp_path, "self", "remove").returncode == 1
    assert executable.read_text() == "foreign command\n"


def test_command_removal_preserves_unrelated_files(tmp_path: Path) -> None:
    assert invoke(tmp_path, "self", "install").returncode == 0
    other = tmp_path / ".local/bin/other"
    _ = other.write_text("keep")
    removed = invoke(tmp_path, "self", "remove")
    assert removed.returncode == 0, removed.stdout + removed.stderr
    assert not (tmp_path / ".local/bin/slopsentral").exists()
    assert other.read_text() == "keep"
    assert invoke(tmp_path, "self", "remove").returncode == 0


def host_fixture(home: Path, host: str, *, disabled: bool = False, fail: bool = False) -> Path:
    binaries = home / "bin"
    binaries.mkdir()
    log = home / "host.jsonl"
    executable = binaries / host
    marketplaces: object = (
        {
            "marketplaces": [
                {
                    "name": "slopsentral",
                    "marketplaceSource": {
                        "sourceType": "git",
                        "source": "https://github.com/amichne/slopsentral.git",
                    },
                }
            ]
        }
        if host == "codex"
        else [{"name": "slopsentral", "source": "GitHub: amichne/slopsentral"}]
    )
    plugins: object = (
        {
            "installed": [
                {
                    "name": "software-engineering",
                    "marketplaceName": "slopsentral",
                    "enabled": not disabled,
                }
            ]
        }
        if host == "codex"
        else [
            {"name": "software-engineering", "marketplace": "slopsentral", "enabled": not disabled}
        ]
    )
    _ = executable.write_text(
        f"#!{sys.executable}\nimport json,sys\n"
        f"with open({str(log)!r}, 'a') as log: log.write(json.dumps(sys.argv[1:]) + '\\n')\n"
        f"marketplaces = {marketplaces!r}\nplugins = {plugins!r}\n"
        "if sys.argv[1:4] == ['plugin','marketplace','list']: print(json.dumps(marketplaces))\n"
        "elif sys.argv[1:3] == ['plugin','list']: print(json.dumps(plugins))\n"
        f"else: sys.exit({7 if fail else 0})\n"
    )
    executable.chmod(0o755)
    return log


@pytest.mark.parametrize("host", ["codex", "copilot"])
def test_native_update_scopes_commands_and_preserves_failure(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    host: str,
) -> None:
    log = host_fixture(tmp_path, host, fail=True)
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, "update", "--host", host, "--plugin", "software-engineering")
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "HOST_FAILED"
    calls = [json.loads(line) for line in log.read_text().splitlines()]
    assert calls[-1] == [
        "plugin",
        "marketplace",
        "upgrade" if host == "codex" else "update",
        "slopsentral",
        *(["--json"] if host == "codex" else []),
    ]
    assert all("install" not in call and "add" not in call for call in calls)


def test_disabled_codex_update_has_no_mutation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    log = host_fixture(tmp_path, "codex", disabled=True)
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, "update", "--host", "codex", "--plugin", "software-engineering")
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "PLUGIN_DISABLED"
    assert all("list" in json.loads(line) for line in log.read_text().splitlines())


def test_invalid_plugin_never_invokes_host(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    log = host_fixture(tmp_path, "codex")
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, "install", "--host", "codex", "--plugin", "../foreign; $(echo no)")
    assert result.returncode == 2
    assert not log.exists()


@pytest.mark.parametrize("host", ["codex", "copilot"])
@pytest.mark.parametrize("action", ["install", "update", "remove"])
def test_native_success_uses_only_selected_plugin(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    host: str,
    action: str,
) -> None:
    log = host_fixture(tmp_path, host)
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, action, "--host", host, "--plugin", "software-engineering")
    assert result.returncode == 0, result.stdout + result.stderr
    calls = [json.loads(line) for line in log.read_text().splitlines()]
    writes = [call for call in calls if "list" not in call]
    if action == "install":
        assert not writes, "an existing install preserves host enablement"
    elif action == "remove":
        assert writes == [
            [
                "plugin",
                "remove" if host == "codex" else "uninstall",
                "software-engineering@slopsentral",
                *(["--json"] if host == "codex" else []),
            ]
        ]
    else:
        assert writes[-1] == [
            "plugin",
            "add" if host == "codex" else "update",
            "software-engineering@slopsentral",
            *(["--json"] if host == "codex" else []),
        ]
    assert "kotlin-engineering" not in log.read_text()


def test_foreign_marketplace_is_preserved(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    log = host_fixture(tmp_path, "codex")
    host = tmp_path / "bin/codex"
    _ = host.write_text(host.read_text().replace("amichne/slopsentral", "foreign/slopsentral"))
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, "install", "--host", "codex", "--plugin", "software-engineering")
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "FOREIGN_SOURCE"
    assert len(log.read_text().splitlines()) == 1


def release_fixture(home: Path, assets: dict[str, bytes]) -> Path:
    remote = home / "remote"
    remote.mkdir()
    for name, data in assets.items():
        _ = (remote / name).write_bytes(data)
    metadata = {
        "tag_name": "slopsentral-v4.0.7",
        "draft": False,
        "prerelease": False,
        "assets": [
            {
                "name": name,
                "size": len(data),
                "digest": "sha256:" + hashlib.sha256(data).hexdigest(),
                "browser_download_url": f"https://github.com/amichne/slopsentral/releases/download/slopsentral-v4.0.7/{name}",
            }
            for name, data in assets.items()
        ],
    }
    _ = (remote / "latest").write_text(json.dumps(metadata))
    binaries = home / "bin"
    binaries.mkdir(exist_ok=True)
    curl = binaries / "curl"
    _ = curl.write_text(
        f"#!{sys.executable}\nimport sys\nfrom pathlib import Path\n"
        f"sys.stdout.buffer.write((Path({str(remote)!r}) / sys.argv[-1].split('/')[-1]).read_bytes())\n"
    )
    curl.chmod(0o755)
    return remote


def amp_archive(*, malicious: bool = False) -> bytes:
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as archive:
        payload = b"export default function(amp) {}\n"
        member = tarfile.TarInfo(
            ".amp/plugins/../../escape"
            if malicious
            else ".amp/plugins/software-engineering/index.js"
        )
        member.size = len(payload)
        archive.addfile(member, io.BytesIO(payload))
    return output.getvalue()


def catalog_archive(
    names: tuple[str, ...] = ("software-engineering", "kotlin-engineering"),
) -> bytes:
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as archive:
        payload = json.dumps(
            {"name": "slopsentral", "plugins": [{"name": name} for name in names]}
        ).encode()
        member = tarfile.TarInfo(".agents/plugins/marketplace.json")
        member.size = len(payload)
        archive.addfile(member, io.BytesIO(payload))
    return output.getvalue()


@pytest.mark.parametrize("host", ["codex", "copilot"])
def test_install_all_uses_release_catalog(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, host: str
) -> None:
    log = host_fixture(tmp_path, host)
    _ = release_fixture(tmp_path, {"slopsentral-codex.tar.gz": catalog_archive()})
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, "install", "--host", host, "--all")
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout)["plugins"] == ["software-engineering", "kotlin-engineering"]
    calls = [json.loads(line) for line in log.read_text().splitlines()]
    assert calls[-1] == [
        "plugin",
        "add" if host == "codex" else "install",
        "kotlin-engineering@slopsentral",
        *(["--json"] if host == "codex" else []),
    ]
    assert all("software-engineering@slopsentral" not in call for call in calls)


@pytest.mark.parametrize("host", ["codex", "copilot"])
def test_update_all_uses_installed_inventory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, host: str
) -> None:
    log = host_fixture(tmp_path, host)
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, "update", "--host", host, "--all")
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout)["plugins"] == ["software-engineering"]
    assert "kotlin-engineering" not in log.read_text()


def test_bulk_update_preserves_disabled_codex_plugin(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    log = host_fixture(tmp_path, "codex", disabled=True)
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, "update", "--host", "codex", "--all")
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "PLUGIN_DISABLED"
    assert all("list" in json.loads(line) for line in log.read_text().splitlines())


def test_bulk_catalog_rejection_precedes_native_mutation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    log = host_fixture(tmp_path, "codex")
    _ = release_fixture(tmp_path, {"slopsentral-codex.tar.gz": catalog_archive(("../foreign",))})
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, "install", "--host", "codex", "--all")
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "INVALID_RELEASE"
    assert not log.exists() or all(
        "list" in json.loads(line) for line in log.read_text().splitlines()
    )


def test_bulk_selection_rejects_ambiguous_or_destructive_requests(tmp_path: Path) -> None:
    for args in [
        ("install", "--host", "codex", "--all", "--plugin", "software-engineering"),
        ("remove", "--host", "codex", "--all"),
    ]:
        result = invoke(tmp_path, *args)
        assert result.returncode == 2
    assert not (tmp_path / "data").exists()


def test_amp_update_all_preserves_foreign_plugins(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _ = release_fixture(tmp_path, {"slopsentral-amp.tar.gz": amp_archive()})
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "config"))
    assert (
        invoke(tmp_path, "install", "--host", "amp", "--plugin", "software-engineering").returncode
        == 0
    )
    foreign = tmp_path / "config/amp/plugins/foreign"
    foreign.mkdir()
    _ = (foreign / "index.js").write_text("keep")
    result = invoke(tmp_path, "update", "--host", "amp", "--all")
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout)["plugins"] == ["software-engineering"]
    assert (foreign / "index.js").read_text() == "keep"


def test_guided_setup_has_no_effect_before_acceptance(monkeypatch: pytest.MonkeyPatch) -> None:
    picks = iter([("install",), ("codex", "amp"), ("cancel",)])
    calls: list[cli.Host] = []

    def dispatch(
        _action: cli.Action, host: cli.Host, _plugins: cli.Selection, _version: str | None
    ) -> dict[str, object]:
        calls.append(host)
        return {"type": "COMPLETED"}

    def choose(
        _title: str, _rows: tuple[tuple[str, str], ...], *, multiple: bool = False
    ) -> tuple[str, ...]:
        _ = multiple
        return next(picks)

    monkeypatch.setattr(cli, "choose", choose)
    monkeypatch.setattr(cli, "dispatch", dispatch)
    result = cli.setup()
    assert isinstance(result, cli.Rejected)
    assert result.reason.value == "CANCELLED"
    assert not calls


def test_guided_setup_stops_after_host_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[cli.Host] = []

    def dispatch(
        _action: cli.Action, host: cli.Host, plugins: cli.Selection, _version: str | None
    ) -> cli.Result[dict[str, object]]:
        assert plugins is cli.AllPlugins.ALL
        calls.append(host)
        return (
            cli.Rejected(cli.Reason.HOST_FAILED, "fixture failure")
            if host is cli.Host.COPILOT
            else {"type": "COMPLETED"}
        )

    monkeypatch.setattr(cli, "dispatch", dispatch)
    result = cli.apply_hosts(cli.Action.UPDATE, ("codex", "copilot", "pi"), None)
    assert isinstance(result, cli.Rejected)
    assert calls == [cli.Host.CODEX, cli.Host.COPILOT]


def test_bulk_empty_inventory_does_not_mutate(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    log = host_fixture(tmp_path, "codex")
    host = tmp_path / "bin/codex"
    _ = host.write_text(
        host.read_text().replace(
            "'installed': [{'name': 'software-engineering', 'marketplaceName': 'slopsentral', 'enabled': True}]",
            "'installed': []",
        )
    )
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, "update", "--host", "codex", "--all")
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout)["plugins"] == []
    assert all("list" in json.loads(line) for line in log.read_text().splitlines())


def test_pi_bulk_delegates_once(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _ = release_fixture(tmp_path, {"setup-pi.mts": b"// fixture installer"})
    node = tmp_path / "bin/node"
    _ = node.write_text(
        f"#!{sys.executable}\nimport sys\nassert sys.argv[2:] == ['--version', '4.0.7']\n"
    )
    node.chmod(0o755)
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, "install", "--host", "pi", "--all")
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.parametrize("names", [(), ("software-engineering", "software-engineering")])
def test_bulk_rejects_empty_or_duplicate_catalog(names: tuple[str, ...]) -> None:
    result = cli.catalog_bytes(catalog_archive(names))
    assert isinstance(result, bytes)
    rejected = cli.catalog_names(cli.parse(result))
    assert isinstance(rejected, cli.Rejected)
    assert rejected.reason is cli.Reason.INVALID_RELEASE


def test_redirected_setup_rejects_without_effects(tmp_path: Path) -> None:
    result = invoke(tmp_path, "setup")
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "TERMINAL_REQUIRED"
    assert not (tmp_path / "data").exists()


@pytest.mark.parametrize("width", [80, 40])
def test_real_selector_keyboard_and_terminal_restoration(tmp_path: Path, width: int) -> None:
    stdout = tmp_path / "stdout.json"
    environment = {
        **os.environ,
        "HOME": str(tmp_path),
        "NO_COLOR": "1",
        "TERM": "xterm-256color",
        "FZF_DEFAULT_OPTS": "--filter=untrusted",
    }
    terminal, slave = pty.openpty()
    with stdout.open("wb") as output:
        process = subprocess.Popen(
            [sys.executable, str(SCRIPT), "setup"],
            cwd=tmp_path,
            env=environment,
            stdin=slave,
            stderr=slave,
            stdout=output,
            start_new_session=True,
        )
    transcript = bytearray()

    def wait_for(text: bytes) -> None:
        end = time.monotonic() + 10
        chunk = bytearray()
        while text not in chunk and time.monotonic() < end:
            ready, _, _ = select.select([terminal], [], [], 0.1)
            if ready:
                data = os.read(terminal, 65536)
                chunk.extend(data)
                transcript.extend(data)
                if b"\x1b[6n" in data:
                    _ = os.write(terminal, b"\x1b[1;1R")
        assert text in chunk, bytes(chunk)

    try:
        termios.tcsetwinsize(terminal, (24, width))
        wait_for(b"Install all plugins")
        _ = os.write(terminal, b"\r")
        wait_for(b"Copilot")
        _ = os.write(terminal, b"\x01\r")
        wait_for(b"Install all for")
        _ = os.write(terminal, b"\x1b")
        end = time.monotonic() + 10
        while process.poll() is None and time.monotonic() < end:
            ready, _, _ = select.select([terminal], [], [], 0.1)
            if ready:
                transcript.extend(os.read(terminal, 65536))
        assert process.wait(timeout=1) == 130
        assert json.loads(stdout.read_text())["reason"] == "CANCELLED"
        flags = termios.tcgetattr(terminal)[3]
        assert flags & termios.ECHO
        assert flags & termios.ICANON
        assert not (tmp_path / ".local").exists()
        assert b"\x1b[?25h" in transcript
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL)
            _ = process.wait(timeout=5)
        os.close(slave)
        os.close(terminal)


def test_amp_install_update_remove_preserves_foreign_directory(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    remote = release_fixture(tmp_path, {"slopsentral-amp.tar.gz": amp_archive()})
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "config"))
    selection = ("--host", "amp", "--plugin", "software-engineering")
    for action in ("install", "update"):
        result = invoke(tmp_path, action, *selection)
        assert result.returncode == 0, result.stdout + result.stderr
    link = tmp_path / "config/amp/plugins/software-engineering"
    assert (link / "index.js").is_file()
    assert invoke(tmp_path, "remove", *selection).returncode == 0
    assert not link.is_symlink()
    link.mkdir()
    _ = (link / "foreign").write_text("keep")
    result = invoke(tmp_path, "install", *selection)
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "OWNERSHIP_CONFLICT"
    assert (link / "foreign").read_text() == "keep"
    assert remote.is_dir()


@pytest.mark.parametrize("failure", ["digest", "origin", "traversal", "cache"])
def test_amp_rejects_unproved_payload_before_registration(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
) -> None:
    remote = release_fixture(
        tmp_path, {"slopsentral-amp.tar.gz": amp_archive(malicious=failure == "traversal")}
    )
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "config"))
    selection = ("--host", "amp", "--plugin", "software-engineering")
    if failure == "digest":
        _ = (remote / "slopsentral-amp.tar.gz").write_bytes(b"different")
    elif failure == "origin":
        metadata = json.loads((remote / "latest").read_text())
        metadata["assets"][0]["browser_download_url"] = "https://foreign.invalid/archive"
        _ = (remote / "latest").write_text(json.dumps(metadata))
    elif failure == "cache":
        assert invoke(tmp_path, "install", *selection).returncode == 0
        link = tmp_path / "config/amp/plugins/software-engineering"
        _ = (link / "index.js").write_text("edited")
        link.unlink()
    result = invoke(tmp_path, "install", *selection)
    assert result.returncode == 1
    assert (
        json.loads(result.stdout)["reason"]
        == {
            "digest": "CHECKSUM_MISMATCH",
            "origin": "INVALID_RELEASE",
            "traversal": "UNSAFE_ARCHIVE",
            "cache": "OWNERSHIP_CONFLICT",
        }[failure]
    )
    assert not (tmp_path / "config/amp/plugins/software-engineering").exists()
    assert not (tmp_path / "escape").exists()


def test_self_update_uses_release_bytes_and_keeps_old_command_on_rejection(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert invoke(tmp_path, "self", "install").returncode == 0
    remote = release_fixture(
        tmp_path,
        {
            "slopsentral.py": SCRIPT.read_bytes() + b"\n# next release\n",
            "session_audit.py": (SCRIPT.parent / "session_audit.py").read_bytes(),
            "audit_history.py": (SCRIPT.parent / "audit_history.py").read_bytes(),
            "slopsentral.py.lock": Path(str(SCRIPT) + ".lock").read_bytes(),
            "kotlin-horizontalization-check": (
                ROOT / "source/hooks/kotlin-horizontalization-check"
            ).read_bytes(),
            "kotlin-horizontalization-check.lock": (
                ROOT / "source/hooks/kotlin-horizontalization-check.lock"
            ).read_bytes(),
        },
    )
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, "self", "update")
    assert result.returncode == 0, result.stdout + result.stderr
    executable = tmp_path / ".local/bin/slopsentral"
    before = executable.read_bytes()
    _ = (remote / "audit_history.py").write_text("bad checksum")
    rejected = invoke(tmp_path, "self", "update")
    assert rejected.returncode == 1
    assert json.loads(rejected.stdout)["reason"] == "CHECKSUM_MISMATCH"
    assert executable.read_bytes() == before
    assert invoke(tmp_path, "self", "remove").returncode == 0


def test_pi_removal_delegates_to_the_release_installer(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = release_fixture(tmp_path, {"setup-pi.mts": b"// admitted fixture installer"})
    node = tmp_path / "bin/node"
    _ = node.write_text(
        f"#!{sys.executable}\nimport sys\nfrom pathlib import Path\n"
        "assert Path(sys.argv[1]).read_bytes() == b'// admitted fixture installer'\n"
        "assert sys.argv[2:] == ['--version', '4.0.7', '--remove']\n"
    )
    node.chmod(0o755)
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, "remove", "--host", "pi")
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.parametrize("existing_uv", [True, False])
def test_shell_bootstrap_reuses_or_installs_uv(
    tmp_path: Path,
    *,
    existing_uv: bool,
) -> None:
    binaries = tmp_path / "bin"
    binaries.mkdir()
    for utility in ("uname", "mktemp", "rm", "sh", "mkdir", "cp", "chmod"):
        location = shutil.which(utility)
        assert location is not None
        (binaries / utility).symlink_to(location)
    fake_uv = tmp_path / "uv-source"
    log = tmp_path / "uv.jsonl"
    _ = fake_uv.write_text(
        f"#!{sys.executable}\nimport json,os,sys\n"
        f"with open({str(log)!r}, 'a') as log: log.write(json.dumps(sys.argv[1:]) + '\\n')\n"
        "assert sys.argv[1:4] == ['run', '--locked', '--script']\n"
        "os.execv(sys.executable, [sys.executable, *sys.argv[4:]])\n"
    )
    fake_uv.chmod(0o755)
    if existing_uv:
        (binaries / "uv").symlink_to(fake_uv)
    installer = tmp_path / "uv-install.sh"
    _ = installer.write_text(
        '#!/bin/sh\nset -eu\nmkdir -p "$UV_UNMANAGED_INSTALL"\n'
        f'cp "{fake_uv}" "$UV_UNMANAGED_INSTALL/uv"\n'
        'chmod +x "$UV_UNMANAGED_INSTALL/uv"\n'
    )
    curl = binaries / "curl"
    _ = curl.write_text(
        f"#!{sys.executable}\nimport shutil,sys\nfrom pathlib import Path\n"
        f"root = Path({str(ROOT)!r})\ninstaller = Path({str(installer)!r})\n"
        "url = next(arg for arg in sys.argv if arg.startswith('https://'))\n"
        "name = url.split('/')[-1]\n"
        "source = installer if 'astral.sh' in url else root / ('source/hooks' if name.startswith('kotlin-horizontalization-check') else 'tools') / name\n"
        "shutil.copyfile(source, sys.argv[sys.argv.index('-o') + 1])\n"
    )
    curl.chmod(0o755)
    environment = {
        **os.environ,
        "HOME": str(tmp_path),
        "XDG_DATA_HOME": str(tmp_path / "data"),
        "PATH": str(binaries),
    }
    result = subprocess.run(
        ["/bin/sh", str(ROOT / "install.sh")],
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert (tmp_path / ".local/bin/slopsentral").is_file()
    assert (tmp_path / ".local/bin/uv").exists() is not existing_uv
    assert json.loads(log.read_text().splitlines()[0])[-2:] == ["self", "install"]
    assert not (tmp_path / ".zshrc").exists()


def test_shell_download_failure_stops_before_python(tmp_path: Path) -> None:
    binaries = tmp_path / "bin"
    binaries.mkdir()
    curl = binaries / "curl"
    _ = curl.write_text("#!/bin/sh\nexit 22\n")
    curl.chmod(0o755)
    result = subprocess.run(
        ["/bin/sh", str(ROOT / "install.sh")],
        cwd=tmp_path,
        env={
            **os.environ,
            "HOME": str(tmp_path),
            "PATH": str(binaries) + os.pathsep + os.environ["PATH"],
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 22
    assert not (tmp_path / ".local/bin/slopsentral").exists()


def test_amp_changed_install_stops_update_and_removal(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = release_fixture(tmp_path, {"slopsentral-amp.tar.gz": amp_archive()})
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "config"))
    selection = ("--host", "amp", "--plugin", "software-engineering")
    assert invoke(tmp_path, "install", *selection).returncode == 0
    link = tmp_path / "config/amp/plugins/software-engineering"
    _ = (link / "index.js").write_text("keep this edit")
    for action in ("update", "remove"):
        rejected = invoke(tmp_path, action, *selection)
        assert rejected.returncode == 1
        assert json.loads(rejected.stdout)["reason"] == "OWNERSHIP_CONFLICT"
        assert link.is_symlink()
        assert (link / "index.js").read_text() == "keep this edit"


def test_installed_audit_uses_bundled_modules_without_changing_receipt(tmp_path: Path) -> None:
    installed = invoke(tmp_path, "self", "install")
    assert installed.returncode == 0, installed.stdout + installed.stderr
    executable = tmp_path / ".local/bin/slopsentral"
    transcript = tmp_path / "audit fixture.jsonl"
    _ = transcript.write_text('{"type":"session","id":"audit-fixture","version":3}\n')
    environment = {
        **os.environ,
        "HOME": str(tmp_path),
        "XDG_DATA_HOME": str(tmp_path / "data"),
        "UV_OFFLINE": "1",
    }
    history = subprocess.run(
        [str(executable), "audit", "history", str(transcript)],
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert history.returncode == 0, history.stdout + history.stderr
    assert json.loads(history.stdout)["sessionId"] == "audit-fixture"
    bad = subprocess.run(
        [str(executable), "audit", "history", str(tmp_path / "missing.jsonl")],
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert bad.returncode == 1
    assert bad.stdout == ""
    assert "not found" in bad.stderr
    assert invoke(tmp_path, "self", "remove").returncode == 0
