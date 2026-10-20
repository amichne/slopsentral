from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from tools import install_global_agents as installer

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "tools/install_global_agents.py"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_fixture(root: Path) -> dict[str, bytes]:
    files = {
        "docs/examples/global/AGENTS.md": b"# Engineering\nKeep established facts.\n",
        "docs/global-agents.md": b"# Sources\nRead [the rule](../source/rule.md).\n",
        "source/rule.md": b"# Rule\nUse constrained values.\n",
    }
    for name, data in files.items():
        file = root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        _ = file.write_bytes(data)
    (root / "tools").mkdir()
    write_manifest(root, files)
    return files


def write_manifest(root: Path, files: dict[str, bytes]) -> None:
    manifest = {
        "type": "SLOPSENTRAL_GLOBAL_ASSETS",
        "schemaVersion": 1,
        "agent": "docs/examples/global/AGENTS.md",
        "guide": "docs/global-agents.md",
        "files": [{"path": name, "sha256": sha256(data)} for name, data in sorted(files.items())],
    }
    _ = (root / "tools/global_agents.lock.json").write_text(json.dumps(manifest, indent=2) + "\n")


def invoke(
    source: Path, destination: Path, action: str = "install"
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            action,
            "--source",
            str(source),
            "--destination",
            str(destination),
        ],
        capture_output=True,
        text=True,
        check=False,
    )


def test_install_copies_pinned_material_and_publishes_relative_links(tmp_path: Path) -> None:
    source = tmp_path / "source"
    files = source_fixture(source)
    destination = tmp_path / "global with spaces;$(literal)"
    destination.mkdir()
    result = invoke(source, destination)
    assert result.returncode == 0, result.stdout + result.stderr
    report = json.loads(result.stdout)
    assert report["type"] == "INSTALLED"
    manifest = (source / "tools/global_agents.lock.json").read_bytes()
    snapshot = destination / ".slopsentral" / sha256(manifest)
    for name, data in files.items():
        assert (snapshot / name).read_bytes() == data
    assert (snapshot / "tools/global_agents.lock.json").read_bytes() == manifest
    agent = (destination / "AGENTS.md").read_bytes()
    assert agent.startswith(files["docs/examples/global/AGENTS.md"])
    assert f".slopsentral/{sha256(manifest)}/docs/global-agents.md" in agent.decode()
    assert report["agentsSha256"] == sha256(agent)
    assert invoke(source, destination, "verify").returncode == 0


@pytest.fixture
def layout(tmp_path: Path) -> tuple[Path, Path, dict[str, bytes]]:
    source, destination = tmp_path / "source", tmp_path / "global"
    files = source_fixture(source)
    destination.mkdir()
    return source, destination, files


def test_repeat_install_preserves_every_file(layout: tuple[Path, Path, dict[str, bytes]]) -> None:
    source, destination, _ = layout
    assert invoke(source, destination).returncode == 0
    before = {
        file: (file.read_bytes(), file.stat().st_mtime_ns)
        for file in destination.rglob("*")
        if file.is_file()
    }
    repeated = invoke(source, destination)
    assert repeated.returncode == 0, repeated.stdout
    assert json.loads(repeated.stdout)["type"] == "UNCHANGED"
    assert {file: (file.read_bytes(), file.stat().st_mtime_ns) for file in before} == before


def test_install_preserves_unrelated_configuration(
    layout: tuple[Path, Path, dict[str, bytes]],
) -> None:
    source, destination, _ = layout
    configuration = destination / "config.toml"
    _ = configuration.write_bytes(b"private = true\n")
    assert invoke(source, destination).returncode == 0
    assert configuration.read_bytes() == b"private = true\n"


def test_source_corruption_rejects_before_destination_writes(
    layout: tuple[Path, Path, dict[str, bytes]],
) -> None:
    source, destination, _ = layout
    _ = (source / "source/rule.md").write_bytes(b"tampered\n")
    result = invoke(source, destination)
    assert result.returncode == 1
    report = json.loads(result.stdout)
    assert report["reason"] == "SHA256_MISMATCH"
    assert report["actual"] == sha256(b"tampered\n")
    assert list(destination.iterdir()) == []


@pytest.mark.parametrize("name", ["AGENTS.md", ".slopsentral"])
def test_existing_user_files_survive(
    layout: tuple[Path, Path, dict[str, bytes]], name: str
) -> None:
    source, destination, _ = layout
    prior = destination / name
    _ = prior.write_bytes(b"private user content\n")
    result = invoke(source, destination)
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "DESTINATION_CONFLICT"
    assert prior.read_bytes() == b"private user content\n"
    assert sorted(file.name for file in destination.iterdir()) == [name]


def test_foreign_resource_directory_survives(layout: tuple[Path, Path, dict[str, bytes]]) -> None:
    source, destination, _ = layout
    prior = destination / ".slopsentral"
    prior.mkdir()
    _ = (prior / "private.txt").write_bytes(b"keep\n")
    assert invoke(source, destination).returncode == 1
    assert (prior / "private.txt").read_bytes() == b"keep\n"
    assert not (destination / "AGENTS.md").exists()


@pytest.mark.parametrize("name", ["AGENTS.md", ".slopsentral"])
def test_destination_symlinks_survive(
    layout: tuple[Path, Path, dict[str, bytes]], name: str
) -> None:
    source, destination, _ = layout
    outside = destination.parent / "outside"
    _ = outside.write_bytes(b"keep\n")
    (destination / name).symlink_to(outside)
    assert invoke(source, destination).returncode == 1
    assert (destination / name).is_symlink()
    assert outside.read_bytes() == b"keep\n"


def test_source_symlink_rejects_even_matching_bytes(
    layout: tuple[Path, Path, dict[str, bytes]],
) -> None:
    source, destination, files = layout
    outside = destination.parent / "outside"
    _ = outside.write_bytes(files["source/rule.md"])
    (source / "source/rule.md").unlink()
    (source / "source/rule.md").symlink_to(outside)
    result = invoke(source, destination)
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "UNSAFE_PATH"
    assert list(destination.iterdir()) == []


@pytest.mark.parametrize("mutation", ["tamper", "missing", "extra", "symlink", "root"])
def test_verify_rejects_installed_drift_without_repair(
    layout: tuple[Path, Path, dict[str, bytes]], mutation: str
) -> None:
    source, destination, _ = layout
    assert invoke(source, destination).returncode == 0
    snapshot = next((destination / ".slopsentral").iterdir())
    asset = snapshot / "source/rule.md"
    if mutation == "tamper":
        _ = asset.write_bytes(b"changed\n")
    elif mutation == "missing":
        asset.unlink()
    elif mutation == "extra":
        _ = (snapshot / "unexpected").write_bytes(b"extra\n")
    elif mutation == "symlink":
        asset.unlink()
        asset.symlink_to(source / "source/rule.md")
    elif mutation == "root":
        _ = (destination / "AGENTS.md").write_bytes(b"user edit\n")
    before = {file: file.lstat().st_mtime_ns for file in destination.rglob("*")}
    result = invoke(source, destination, "verify")
    assert result.returncode == 1, result.stdout
    assert {file: file.lstat().st_mtime_ns for file in destination.rglob("*")} == before
    assert invoke(source, destination).returncode == 1


@pytest.mark.parametrize("path", ["../outside", "/absolute", "source/../outside", "a\\b", "a//b"])
def test_manifest_paths_cannot_escape(
    layout: tuple[Path, Path, dict[str, bytes]], path: str
) -> None:
    source, destination, _ = layout
    manifest = source / "tools/global_agents.lock.json"
    raw = manifest.read_text().replace('"source/rule.md"', json.dumps(path))
    _ = manifest.write_text(raw)
    result = invoke(source, destination)
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "UNSAFE_PATH"
    assert list(destination.iterdir()) == []


def test_duplicate_manifest_keys_reject(layout: tuple[Path, Path, dict[str, bytes]]) -> None:
    source, destination, _ = layout
    manifest = source / "tools/global_agents.lock.json"
    raw = manifest.read_text().replace(
        '"schemaVersion": 1,', '"schemaVersion": 1, "schemaVersion": 1,'
    )
    _ = manifest.write_text(raw)
    result = invoke(source, destination)
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "INVALID_MANIFEST"
    assert list(destination.iterdir()) == []


@pytest.mark.parametrize(
    "mutation",
    [
        "unknown-field",
        "boolean-version",
        "bad-digest",
        "duplicate-asset",
        "missing-agent",
        "unknown-type",
    ],
)
def test_malformed_manifest_never_writes(
    layout: tuple[Path, Path, dict[str, bytes]],
    mutation: str,
) -> None:
    source, destination, _ = layout
    file = source / "tools/global_agents.lock.json"
    document = json.loads(file.read_bytes())
    if mutation == "unknown-field":
        document["extra"] = True
    elif mutation == "boolean-version":
        document["schemaVersion"] = True
    elif mutation == "bad-digest":
        document["files"][0]["sha256"] = "not-a-digest"
    elif mutation == "duplicate-asset":
        document["files"].append(document["files"][0])
    elif mutation == "missing-agent":
        document["files"] = [
            item for item in document["files"] if item["path"] != "docs/examples/global/AGENTS.md"
        ]
    elif mutation == "unknown-type":
        document["type"] = "OTHER"
    _ = file.write_text(json.dumps(document))
    result = invoke(source, destination)
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "INVALID_MANIFEST"
    assert list(destination.iterdir()) == []


def test_manifest_pin_rejects_before_writes(layout: tuple[Path, Path, dict[str, bytes]]) -> None:
    source, destination, _ = layout
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "install",
            "--source",
            str(source),
            "--destination",
            str(destination),
            "--expected-manifest-sha256",
            "0" * 64,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "SHA256_MISMATCH"
    assert list(destination.iterdir()) == []


def test_failed_publication_preserves_racing_user_file(
    layout: tuple[Path, Path, dict[str, bytes]], monkeypatch: pytest.MonkeyPatch
) -> None:
    source, destination, _ = layout
    prepared = installer.prepare(source)
    assert not isinstance(prepared, (installer.Rejected, installer.HashMismatch))

    def racing_link(_source: object, _destination: object, **_kwargs: object) -> None:
        _ = (destination / "AGENTS.md").write_bytes(b"another writer\n")
        raise FileExistsError

    monkeypatch.setattr(installer.os, "link", racing_link)
    outcome = installer.install(destination, prepared)
    assert isinstance(outcome, installer.Rejected)
    assert (destination / "AGENTS.md").read_bytes() == b"another writer\n"
    assert not (destination / ".slopsentral").exists()
    assert sorted(file.name for file in destination.iterdir()) == ["AGENTS.md"]


def test_two_installers_never_replace_each_other(
    layout: tuple[Path, Path, dict[str, bytes]],
) -> None:
    source, destination, _ = layout
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(invoke, source, destination) for _ in range(2)]
        results = [future.result() for future in futures]
    assert sum(json.loads(result.stdout)["type"] == "INSTALLED" for result in results) == 1
    assert invoke(source, destination, "verify").returncode == 0
    assert sorted(file.name for file in destination.iterdir()) == [".slopsentral", "AGENTS.md"]


def test_markdown_links_preserve_reference_links_and_ignore_code() -> None:
    parser = installer.MarkdownIt("commonmark").enable("table")
    text = "[reference][rule]\n\n[rule]: ../rule.md#section\n\n`[fake](../missing)`\n\n```text\n[also fake](../absent)\n```\n"
    assert installer.link_targets(parser.parse(text)) == ("../rule.md#section",)
    assert installer.local_target("docs/example.md", "../rule%20name.md#section") == "rule name.md"


def test_copied_verifier_works_offline_without_source_checkout(
    layout: tuple[Path, Path, dict[str, bytes]],
) -> None:
    source, destination, files = layout
    for name in ("tools/install_global_agents.py", "tools/install_global_agents.py.lock"):
        raw = (ROOT / name).read_bytes()
        files[name] = raw
        _ = (source / name).write_bytes(raw)
    write_manifest(source, files)
    assert invoke(source, destination).returncode == 0
    snapshot = next((destination / ".slopsentral").iterdir())
    _ = source.rename(source.with_name("checkout removed"))
    result = subprocess.run(
        [
            "uv",
            "run",
            "--offline",
            "--locked",
            "--script",
            str(snapshot / "tools/install_global_agents.py"),
            "verify",
            "--destination",
            str(destination),
        ],
        cwd=destination,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout)["type"] == "VERIFIED"


@pytest.mark.parametrize("name", ["AGENTS.md", "rule.md"])
def test_staged_corruption_never_publishes(
    layout: tuple[Path, Path, dict[str, bytes]],
    monkeypatch: pytest.MonkeyPatch,
    name: str,
) -> None:
    source, destination, _ = layout
    prepared = installer.prepare(source)
    assert not isinstance(prepared, (installer.Rejected, installer.HashMismatch))
    original = Path.write_bytes

    def corrupt(path: Path, raw: bytes) -> int:
        if path.name == name and ".slopsentral-stage-" in str(path):
            return original(path, b"damaged write\n")
        return original(path, raw)

    monkeypatch.setattr(Path, "write_bytes", corrupt)
    result = installer.install(destination, prepared)
    assert isinstance(result, installer.HashMismatch)
    assert list(destination.iterdir()) == []


def test_cleanup_keeps_unexpected_files_and_reports_recovery(
    layout: tuple[Path, Path, dict[str, bytes]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source, destination, _ = layout
    prepared = installer.prepare(source)
    assert not isinstance(prepared, (installer.Rejected, installer.HashMismatch))

    def failed_link(_source: object, _destination: object, **_kwargs: object) -> None:
        _ = (destination / ".slopsentral/other-writer").write_bytes(b"keep\n")
        raise PermissionError

    monkeypatch.setattr(installer.os, "link", failed_link)
    result = installer.install(destination, prepared)
    assert isinstance(result, installer.RecoveryNeeded)
    assert not (destination / "AGENTS.md").exists()
    assert (destination / ".slopsentral/other-writer").read_bytes() == b"keep\n"


def test_interruption_keeps_unpublished_snapshot_for_inspection(
    layout: tuple[Path, Path, dict[str, bytes]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source, destination, _ = layout
    prepared = installer.prepare(source)
    assert not isinstance(prepared, (installer.Rejected, installer.HashMismatch))

    def interrupted_link(_source: object, _destination: object, **_kwargs: object) -> None:
        raise KeyboardInterrupt

    monkeypatch.setattr(installer.os, "link", interrupted_link)
    with pytest.raises(KeyboardInterrupt):
        _ = installer.install(destination, prepared)
    assert not (destination / "AGENTS.md").exists()
    assert (destination / ".slopsentral").is_dir()
    assert invoke(source, destination).returncode == 1


def test_symlinked_destination_root_rejects(
    layout: tuple[Path, Path, dict[str, bytes]],
) -> None:
    source, destination, _ = layout
    link = destination.with_name("linked root")
    link.symlink_to(destination, target_is_directory=True)
    assert invoke(source, link).returncode == 1
    assert list(destination.iterdir()) == []


def test_broken_local_link_cannot_enter_manifest(
    layout: tuple[Path, Path, dict[str, bytes]],
) -> None:
    source, _, files = layout
    _ = (source / "docs/global-agents.md").write_text("[missing](../absent.md)\n")
    inventory = frozenset(
        {*files, "tools/install_global_agents.py", "tools/install_global_agents.py.lock"}
    )
    for name in ("tools/install_global_agents.py", "tools/install_global_agents.py.lock"):
        _ = (source / name).write_bytes(b"fixture\n")
    result = installer.collect(source, inventory)
    assert isinstance(result, installer.Rejected)
    assert result.reason == installer.Reason.SOURCE_GRAPH_INVALID
    assert result.path == "absent.md"


def test_repository_manifest_matches_current_references() -> None:
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "manifest"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout)["type"] == "MANIFEST_CURRENT"


def test_manifest_inventory_ignores_ambient_git_selectors(tmp_path: Path) -> None:
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "manifest"],
        env={
            **os.environ,
            "GIT_DIR": str(tmp_path / "foreign.git"),
            "GIT_WORK_TREE": str(tmp_path),
            "GIT_INDEX_FILE": str(tmp_path / "foreign.index"),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout)["type"] == "MANIFEST_CURRENT"


def test_full_repository_bundle_keeps_every_digest(tmp_path: Path) -> None:
    destination = tmp_path / "full global installation"
    destination.mkdir()
    result = invoke(ROOT, destination)
    assert result.returncode == 0, result.stdout + result.stderr
    raw = (ROOT / "tools/global_agents.lock.json").read_bytes()
    manifest = json.loads(raw)
    snapshot = destination / ".slopsentral" / sha256(raw)
    for asset in manifest["files"]:
        installed = snapshot / asset["path"]
        assert sha256(installed.read_bytes()) == asset["sha256"], asset["path"]
    assert (snapshot / "source/concepts/type-safety/core.md").is_file()
    assert (snapshot / "source/skills/semantic-ratchet/references/proof-discipline.md").is_file()
    assert invoke(snapshot, destination, "verify").returncode == 0
