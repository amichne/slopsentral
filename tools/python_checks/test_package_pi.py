from __future__ import annotations

import hashlib
import json
import tarfile
from typing import TYPE_CHECKING

import pytest

from tools.package_pi import Code, Packed, Rejected, package

if TYPE_CHECKING:
    from pathlib import Path


def fixture(root: Path) -> Path:
    root.mkdir()
    manifest = {
        "name": "slopsentral-pi",
        "version": "0.1.0",
        "peerDependencies": {"@earendil-works/pi-coding-agent": "*"},
    }
    _ = (root / "package.json").write_text(json.dumps(manifest))
    for name in [
        "profiles.json",
        "marketplace-lock.json",
        "extensions/slopsentral.ts",
        "extensions/runtime.ts",
        "hooks/gate.py",
        "hooks/gate.py.lock",
        ".mcp.json",
    ]:
        file = root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        _ = file.write_bytes(("payload " + name).encode())
    (root / "hooks/gate.py").chmod(0o755)
    return root


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
