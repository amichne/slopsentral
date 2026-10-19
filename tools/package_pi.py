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
from typing import Literal, TypeGuard


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


@dataclass(frozen=True, slots=True)
class _ContentResource:
    name: str
    path: str
    sha256: str


@dataclass(frozen=True, slots=True)
class _ContentInventory:
    skills: tuple[_ContentResource, ...]
    instructions: tuple[_ContentResource, ...]


def content_resources(
    value: object,
    folder: Literal["skills", "instructions"],
) -> tuple[_ContentResource, ...] | Rejected:
    if not sequence(value):
        return Rejected(Code.INVALID_PACKAGE)
    records: list[_ContentResource] = []
    for record in value:
        if not mapping(record) or set(record) != {"name", "path", "sha256"}:
            return Rejected(Code.INVALID_PACKAGE)
        name, path, digest = record["name"], record["path"], record["sha256"]
        if not isinstance(name, str) or not re.fullmatch(r"[a-z][a-z0-9-]*", name):
            return Rejected(Code.INVALID_PACKAGE)
        suffix = r"\.md" if folder == "instructions" else ""
        if (
            not isinstance(path, str)
            or not re.fullmatch(rf"[a-z][a-z0-9-]*/{folder}/{re.escape(name)}{suffix}", path)
            or not isinstance(digest, str)
            or not re.fullmatch(r"sha256:[a-f0-9]{64}", digest)
        ):
            return Rejected(Code.INVALID_PACKAGE)
        records.append(_ContentResource(name, path, digest))
    if len({item.name for item in records}) != len(records) or len(
        {item.path for item in records}
    ) != len(records):
        return Rejected(Code.INVALID_PACKAGE)
    return tuple(records)


def content_digest(root: Path, path: str, names: set[str]) -> str:
    digest = hashlib.sha256()
    if path in names:
        digest.update((root / path).read_bytes())
    else:
        for file in sorted(name for name in names if name.startswith(path + "/")):
            digest.update(file[len(path) + 1 :].encode())
            digest.update(b"\0")
            digest.update((root / file).read_bytes())
            digest.update(b"\0")
    return "sha256:" + digest.hexdigest()


def content_inventory(
    root: Path,
    selected: _ContentPaths,
    names: set[str],
) -> _ContentInventory | Rejected:
    try:
        inventory: object = json.loads((root / "profile-inventory.json").read_bytes())
    except (json.JSONDecodeError, UnicodeDecodeError):
        return Rejected(Code.INVALID_PACKAGE)
    if (
        not mapping(inventory)
        or set(inventory)
        != {
            "type",
            "schemaVersion",
            "profile",
            "invocation",
            "instructionFile",
            "skills",
            "instructions",
        }
        or inventory["type"] != "PI_CONTENT_PROFILE"
        or type(inventory["schemaVersion"]) is not int
        or inventory["schemaVersion"] != 1
        or inventory["invocation"] != "either"
        or inventory["instructionFile"] != "AGENTS.md"
        or not isinstance(profile := inventory["profile"], str)
        or not re.fullmatch(r"[a-z][a-z0-9-]*", profile)
    ):
        return Rejected(Code.INVALID_PACKAGE)
    skills = content_resources(inventory["skills"], "skills")
    instructions = content_resources(inventory["instructions"], "instructions")
    if isinstance(skills, Rejected) or isinstance(instructions, Rejected):
        return Rejected(Code.INVALID_PACKAGE)
    if {item.path for item in skills} != set(selected.entries) or any(
        item.path not in names for item in instructions
    ):
        return Rejected(Code.INVALID_PACKAGE)
    combined = b"\n".join((root / item.path).read_bytes() for item in instructions)
    if (
        any(
            content_digest(root, item.path, names) != item.sha256
            for item in (*skills, *instructions)
        )
        or (root / "AGENTS.md").read_bytes() != combined
    ):
        return Rejected(Code.INVALID_PACKAGE)
    return _ContentInventory(skills, instructions)


def content_selection(root: Path, manifest: dict[str, object], names: set[str]) -> bool:
    metadata = {
        "package.json",
        "AGENTS.md",
        "marketplace.json",
        "marketplace-lock.json",
        "profile-inventory.json",
    }
    if not metadata.issubset(names):
        return False
    resources = manifest.get("pi")
    if not mapping(resources) or set(resources) != {"skills"} or manifest.get("peerDependencies"):
        return False
    selected = content_paths(resources["skills"], names)
    if isinstance(selected, Rejected):
        return False
    inventory = content_inventory(root, selected, names)
    if isinstance(inventory, Rejected):
        return False
    allowed = metadata | {item.path for item in inventory.instructions}
    return all(
        name in allowed or any(name.startswith(item.path + "/") for item in inventory.skills)
        for name in names
    )


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
    accepted = content_selection(root, value, names)
    return _Package(root, version, files) if accepted else Rejected(Code.INVALID_PACKAGE)


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
