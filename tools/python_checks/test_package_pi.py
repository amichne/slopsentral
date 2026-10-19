from __future__ import annotations

import hashlib
import json
import tarfile
from typing import TYPE_CHECKING, Literal

import pytest

from tools.package_pi import Code, Packed, Rejected, package

if TYPE_CHECKING:
    from pathlib import Path


def fixture(root: Path) -> Path:
    root.mkdir()
    manifest = {
        "name": "slopsentral-pi",
        "version": "0.1.0",
        "peerDependencies": {"@earendil-works/pi-coding-agent": "*", "@earendil-works/pi-tui": "*"},
    }
    _ = (root / "package.json").write_text(json.dumps(manifest))
    for name in [
        "profiles.json",
        "marketplace-lock.json",
        "extensions/slopsentral.ts",
        "extensions/runtime.ts",
        "capabilities.json",
        "schemas/settings.schema.json",
        "schemas/capabilities.schema.json",
        "schemas/scope-assessment.schema.json",
        "extensions/settings.ts",
        "extensions/skills.ts",
        "extensions/control.ts",
        "extensions/journal.ts",
        "extensions/coordinator.ts",
        "extensions/menu.ts",
        "hooks/gate.py",
        "hooks/gate.py.lock",
        ".mcp.json",
    ]:
        file = root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        _ = file.write_bytes(("payload " + name).encode())
    (root / "hooks/gate.py").chmod(0o755)
    return root


def content_fixture(root: Path) -> Path:
    root.mkdir()
    _ = (root / "package.json").write_text(
        json.dumps(
            {
                "name": "slopsentral-pi",
                "version": "0.1.0",
                "pi": {"skills": ["./owner/skills/example"]},
            }
        )
    )
    skill = root / "owner/skills/example/SKILL.md"
    skill.parent.mkdir(parents=True)
    _ = skill.write_text("---\nname: example\ndescription: Example skill.\n---\nUse the example.\n")
    for name in ["marketplace.json", "marketplace-lock.json", "AGENTS.md"]:
        _ = (root / name).write_text("{}")
    _ = (root / "profile-inventory.json").write_text(
        json.dumps(
            {
                "type": "PI_CONTENT_PROFILE",
                "schemaVersion": 1,
                "profile": "fixture",
                "invocation": "either",
                "instructionFile": "AGENTS.md",
                "skills": [
                    {
                        "name": "example",
                        "path": "owner/skills/example",
                        "sha256": "sha256:" + "a" * 64,
                    }
                ],
                "instructions": [],
            }
        )
    )
    return root


def test_content_package_needs_no_runtime_peer_or_extension(tmp_path: Path) -> None:
    root = content_fixture(tmp_path / "package")
    assert isinstance(package(root, tmp_path / "output"), Packed)


@pytest.mark.parametrize(
    "mutation", ["extension", "profiles", "peer", "missing-skill", "missing-inventory", "escape"]
)
def test_content_package_rejects_runtime_and_incomplete_selection(
    tmp_path: Path,
    mutation: Literal[
        "extension", "profiles", "peer", "missing-skill", "missing-inventory", "escape"
    ],
) -> None:
    root = content_fixture(tmp_path / "package")
    manifest = json.loads((root / "package.json").read_text())
    match mutation:
        case "extension":
            manifest["pi"]["extensions"] = ["./extension.ts"]
        case "profiles":
            _ = (root / "profiles.json").write_text("{}")
        case "peer":
            manifest["peerDependencies"] = {"@earendil-works/pi-coding-agent": "*"}
        case "missing-skill":
            (root / "owner/skills/example/SKILL.md").unlink()
        case "missing-inventory":
            (root / "profile-inventory.json").unlink()
        case "escape":
            manifest["pi"]["skills"] = ["../example"]
    _ = (root / "package.json").write_text(json.dumps(manifest))
    assert package(root, tmp_path / "output") == Rejected(Code.INVALID_PACKAGE)
    assert not (tmp_path / "output").exists()


@pytest.mark.parametrize(
    "name",
    [
        "capabilities.json",
        "extensions/control.ts",
        "extensions/skills.ts",
        "schemas/settings.schema.json",
    ],
)
def test_incomplete_capability_runtime_never_produces_an_archive(tmp_path: Path, name: str) -> None:
    root = fixture(tmp_path / "package")
    (root / name).unlink()
    assert package(root, tmp_path / "output") == Rejected(Code.INVALID_PACKAGE)
    assert not (tmp_path / "output").exists()


def test_archive_keeps_payload_modes_and_repeats_exactly(tmp_path: Path) -> None:
    root = fixture(tmp_path / "package")
    first = package(root, tmp_path / "first")
    assert isinstance(first, Packed)
    with tarfile.open(first.archive) as packed:
        expected = {
            "package/" + file.relative_to(root).as_posix(): file
            for file in root.rglob("*")
            if file.is_file()
        }
        assert set(packed.getnames()) == set(expected)
        for member in packed.getmembers():
            payload = packed.extractfile(member)
            assert payload is not None
            assert payload.read() == expected[member.name].read_bytes()
            assert member.mode == expected[member.name].stat().st_mode & 0o777
    assert first.sha256 == hashlib.sha256(first.archive.read_bytes()).hexdigest()
    assert (
        tmp_path / "first/SHA256SUMS"
    ).read_text() == f"{first.sha256}  slopsentral-pi-0.1.0.tgz\n"
    second = package(root, tmp_path / "second")
    assert isinstance(second, Packed)
    assert first.archive.read_bytes() == second.archive.read_bytes()
    assert package(root, tmp_path / "first") == Rejected(Code.IO_FAILED)


@pytest.mark.parametrize(
    "extra",
    [
        {"scripts": {"prepare": "unsafe"}},
        {"dependencies": {"unsafe": "*"}},
        {"version": "../unsafe"},
    ],
)
def test_no_archive_exists_for_an_unsafe_manifest(tmp_path: Path, extra: dict[str, object]) -> None:
    root = fixture(tmp_path / "package")
    manifest = json.loads((root / "package.json").read_text())
    _ = (root / "package.json").write_text(json.dumps({**manifest, **extra}))
    assert package(root, tmp_path / "output") == Rejected(Code.INVALID_PACKAGE)
    assert not (tmp_path / "output").exists()


@pytest.mark.parametrize("name", [".git", "node_modules", ".pytest_cache", ".ruff_cache"])
def test_generated_consumers_exclude_local_state(tmp_path: Path, name: str) -> None:
    root = fixture(tmp_path / "package")
    (root / name).mkdir()
    assert package(root, tmp_path / "output") == Rejected(Code.INVALID_PACKAGE)
    assert not (tmp_path / "output").exists()


def test_symlinks_and_missing_payloads_are_rejected(tmp_path: Path) -> None:
    root = fixture(tmp_path / "package")
    link = root / "linked"
    link.symlink_to(root / "profiles.json")
    assert package(root, tmp_path / "output") == Rejected(Code.INVALID_PACKAGE)
    link.unlink()
    (root / "profiles.json").unlink()
    assert package(root, tmp_path / "output") == Rejected(Code.INVALID_PACKAGE)


def test_ci_version_is_in_the_archive_without_a_source_edit(tmp_path: Path) -> None:
    root = fixture(tmp_path / "package")
    before = (root / "package.json").read_bytes()
    result = package(root, tmp_path / "output", version="0.1.123")
    assert isinstance(result, Packed)
    assert result.version == "0.1.123"
    assert result.archive.name == "slopsentral-pi-0.1.123.tgz"
    with tarfile.open(result.archive) as packed:
        manifest = packed.extractfile("package/package.json")
        assert manifest is not None
        assert json.loads(manifest.read())["version"] == "0.1.123"
    assert (root / "package.json").read_bytes() == before


@pytest.mark.parametrize("version", ["../escape", "0.1.1\ninjected=value", "0.1.-1"])
def test_ci_version_rejects_paths_and_output_injection(tmp_path: Path, version: str) -> None:
    root = fixture(tmp_path / "package")
    assert package(root, tmp_path / "output", version=version) == Rejected(Code.INVALID_PACKAGE)
    assert not (tmp_path / "output").exists()
