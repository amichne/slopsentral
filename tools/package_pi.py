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
        or value.get("peerDependencies") != {"@earendil-works/pi-coding-agent": "*"}
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
    required = {
        "package.json",
        "profiles.json",
        "marketplace-lock.json",
        "extensions/slopsentral.ts",
        "extensions/runtime.ts",
    }
    if not required.issubset({entry.relative_to(root).as_posix() for entry in files}):
        return Rejected(Code.INVALID_PACKAGE)
    return _Package(root, version, files)


def package(root: Path, output: Path) -> Packed | Rejected:
    try:
        inspected = inspect(root)
        if isinstance(inspected, Rejected):
            return inspected
        output.mkdir(parents=True, exist_ok=False)
        archive = output / f"slopsentral-pi-{inspected.version}.tgz"
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
                with file.open("rb") as payload:
                    packed.addfile(info, payload)
        with archive.open("rb") as payload:
            digest = hashlib.file_digest(payload, "sha256").hexdigest()
        _ = (output / "SHA256SUMS").write_text(f"{digest}  {archive.name}\n")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return Rejected(Code.INVALID_PACKAGE)
    except (OSError, tarfile.TarError):
        return Rejected(Code.IO_FAILED)
    return Packed(inspected.version, archive, digest)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("package", type=Path)
    _ = parser.add_argument("out", type=Path)
    _ = parser.add_argument("--github-output", type=Path)
    args = parser.parse_args()
    root: Path = args.package
    output: Path = args.out
    github_output: Path | None = args.github_output
    result = package(root, output)
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
