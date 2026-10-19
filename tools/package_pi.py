#!/usr/bin/env -S uv run --locked --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = []
# [tool.uv]
# no-build = true
# required-version = ">=0.12.9"
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""Package a projected Pi tree without npm, dependency downloads, or lifecycle scripts."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import re
import tarfile
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import TypeGuard


class Code(StrEnum):
    INVALID_PACKAGE = "INVALID_PACKAGE"
    IO_FAILED = "IO_FAILED"


@dataclass(frozen=True, slots=True)
class Rejected:
    code: Code


@dataclass(frozen=True, slots=True)
class _Package:
    root: Path
    version: str
    files: tuple[Path, ...]


@dataclass(frozen=True, slots=True)
class Packed:
    version: str
    archive: Path
    sha256: str


def mapping(value: object) -> TypeGuard[dict[str, object]]:
    return isinstance(value, dict)


def sequence(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


@dataclass(frozen=True, slots=True)
class _ContentPaths:
    entries: tuple[str, ...]


def content_paths(value: object, names: set[str]) -> _ContentPaths | Rejected:
    if not sequence(value) or not value:
        return Rejected(Code.INVALID_PACKAGE)
    selected: list[str] = []
    for path in value:
        if not isinstance(path, str) or not re.fullmatch(
            r"\./[a-z][a-z0-9-]*/skills/[a-z][a-z0-9-]*", path
        ):
            return Rejected(Code.INVALID_PACKAGE)
        if path[2:] + "/SKILL.md" not in names:
            return Rejected(Code.INVALID_PACKAGE)
        selected.append(path[2:])
    if len(set(selected)) != len(selected):
        return Rejected(Code.INVALID_PACKAGE)
    return _ContentPaths(tuple(selected))


def content_inventory(root: Path, selected: _ContentPaths) -> bool:
    inventory: object = json.loads((root / "profile-inventory.json").read_bytes())
    if not mapping(inventory) or inventory.get("type") != "PI_CONTENT_PROFILE":
        return False
    if inventory.get("schemaVersion") != 1 or inventory.get("invocation") != "either":
        return False
    skills = inventory.get("skills")
    if not sequence(skills) or not all(mapping(skill) for skill in skills):
        return False
    paths = [skill.get("path") for skill in skills if mapping(skill)]
    return (
        len(paths) == len(selected.entries)
        and all(path in selected.entries for path in paths)
        and len(set(paths)) == len(paths)
    )


def content_selection(root: Path, manifest: dict[str, object], names: set[str]) -> bool:
    required = {"AGENTS.md", "marketplace.json", "marketplace-lock.json", "profile-inventory.json"}
    forbidden = {"extensions", "profiles.json", "capabilities.json", "schemas"}
    if not required.issubset(names) or any(name.split("/")[0] in forbidden for name in names):
        return False
    resources = manifest.get("pi")
    if not mapping(resources) or set(resources) != {"skills"} or manifest.get("peerDependencies"):
        return False
    selected = content_paths(resources["skills"], names)
    return isinstance(selected, _ContentPaths) and content_inventory(root, selected)


def inspect(root: Path) -> _Package | Rejected:
    if root.is_symlink() or not root.is_dir():
        return Rejected(Code.INVALID_PACKAGE)
    value: object = json.loads((root / "package.json").read_bytes())
    if not mapping(value):
        return Rejected(Code.INVALID_PACKAGE)
    version = value.get("version")
    if (
        value.get("name") != "slopsentral-pi"
        or not isinstance(version, str)
        or not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version)
        or value.get("scripts")
        or value.get("dependencies")
        or value.get("optionalDependencies")
        or value.get("devDependencies")
    ):
        return Rejected(Code.INVALID_PACKAGE)
    entries = tuple(sorted(root.rglob("*")))
    forbidden = {".git", "node_modules", "__pycache__", ".pytest_cache", ".ruff_cache", ".venv"}
    if any(
        entry.is_symlink() or not (entry.is_dir() or entry.is_file()) or entry.name in forbidden
        for entry in entries
    ):
        return Rejected(Code.INVALID_PACKAGE)
    files = tuple(entry for entry in entries if entry.is_file())
    names = {entry.relative_to(root).as_posix() for entry in files}
    accepted = (
        content_selection(root, value, names)
        if "profile-inventory.json" in names
        else runtime_selection(value, names)
    )
    return _Package(root, version, files) if accepted else Rejected(Code.INVALID_PACKAGE)


def runtime_selection(manifest: dict[str, object], names: set[str]) -> bool:
    if manifest.get("peerDependencies") != {
        "@earendil-works/pi-coding-agent": "*",
        "@earendil-works/pi-tui": "*",
    }:
        return False
    required = {
        "package.json",
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
    }
    return required.issubset(names)


def package(root: Path, output: Path, *, version: str | None = None) -> Packed | Rejected:
    try:
        inspected = inspect(root)
        if isinstance(inspected, Rejected):
            return inspected
        selected = inspected.version if version is None else version
        if not re.fullmatch(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)", selected):
            return Rejected(Code.INVALID_PACKAGE)
        output.mkdir(parents=True, exist_ok=False)
        archive = output / f"slopsentral-pi-{selected}.tgz"
        with (
            archive.open("xb") as stream,
            gzip.GzipFile(fileobj=stream, mode="wb", filename="", mtime=0) as compressed,
            tarfile.open(fileobj=compressed, mode="w") as packed,
        ):
            for file in inspected.files:
                info = packed.gettarinfo(
                    str(file), "package/" + file.relative_to(inspected.root).as_posix()
                )
                info.uid = info.gid = info.mtime = 0
                info.uname = info.gname = ""
                if file == inspected.root / "package.json" and version is not None:
                    manifest: object = json.loads(file.read_bytes())
                    if not mapping(manifest):
                        return Rejected(Code.INVALID_PACKAGE)
                    manifest["version"] = selected
                    data = (json.dumps(manifest, indent=2) + "\n").encode()
                    info.size = len(data)
                    packed.addfile(info, io.BytesIO(data))
                    continue
                with file.open("rb") as payload:
                    packed.addfile(info, payload)
        with archive.open("rb") as payload:
            digest = hashlib.file_digest(payload, "sha256").hexdigest()
        _ = (output / "SHA256SUMS").write_text(f"{digest}  {archive.name}\n")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return Rejected(Code.INVALID_PACKAGE)
    except (OSError, tarfile.TarError):
        return Rejected(Code.IO_FAILED)
    return Packed(selected, archive, digest)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("package", type=Path)
    _ = parser.add_argument("out", type=Path)
    _ = parser.add_argument("--github-output", type=Path)
    _ = parser.add_argument("--version")
    args = parser.parse_args()
    root: Path = args.package
    output: Path = args.out
    github_output: Path | None = args.github_output
    version: str | None = args.version
    result = package(root, output, version=version)
    if isinstance(result, Rejected):
        print(json.dumps({"type": "REJECTED", "code": result.code}))
        return 1
    if github_output is not None:
        try:
            with github_output.open("a") as stream:
                _ = stream.write(f"version={result.version}\narchive={result.archive}\n")
        except OSError:
            print(json.dumps({"type": "REJECTED", "code": Code.IO_FAILED}))
            return 1
    print(
        json.dumps(
            {
                "type": "PACKAGED",
                "version": result.version,
                "archive": str(result.archive),
                "sha256": result.sha256,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
