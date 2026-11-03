from __future__ import annotations

import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path

import pytest

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
    for command in ["install", "update", "remove", "self"]:
        assert command in result.stdout
    rejected = invoke(tmp_path, "install")
    assert rejected.returncode == 2
    assert "--host" in rejected.stderr
    assert not (tmp_path / "data").exists()


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
            "slopsentral.py.lock": Path(str(SCRIPT) + ".lock").read_bytes(),
        },
    )
    monkeypatch.setenv("PATH", str(tmp_path / "bin") + os.pathsep + os.environ["PATH"])
    result = invoke(tmp_path, "self", "update")
    assert result.returncode == 0, result.stdout + result.stderr
    executable = tmp_path / ".local/bin/slopsentral"
    before = executable.read_bytes()
    _ = (remote / "slopsentral.py").write_text("bad checksum")
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
        "source = installer if 'astral.sh' in url else root / 'tools' / name\n"
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
