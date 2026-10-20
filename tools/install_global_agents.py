#!/usr/bin/env -S uv run --locked --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = ["markdown-it-py==4.0.0"]
# [tool.uv]
# no-build = true
# required-version = ">=0.12.9"
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""Install pinned global instructions and a local reference snapshot."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import posixpath
import re
import shutil
import stat
import subprocess
import tempfile
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path, PurePosixPath
from typing import TYPE_CHECKING, Literal, TypeGuard, assert_never
from urllib.parse import unquote, urlsplit

from markdown_it import MarkdownIt

if TYPE_CHECKING:
    from markdown_it.token import Token

AGENT = "docs/examples/global/AGENTS.md"
GUIDE = "docs/global-agents.md"
LOCK = "tools/global_agents.lock.json"
SEEDS = (AGENT, GUIDE, "tools/install_global_agents.py", "tools/install_global_agents.py.lock")
MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_BUNDLE_BYTES = 16 * 1024 * 1024
MAX_FILES = 4096
SKILL_ROOT_PARTS = 3
GIT_SELECTORS = frozenset(
    {
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_INDEX_FILE",
        "GIT_COMMON_DIR",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    }
)


class Reason(StrEnum):
    INVALID_MANIFEST = "INVALID_MANIFEST"
    UNSAFE_PATH = "UNSAFE_PATH"
    SOURCE_GRAPH_INVALID = "SOURCE_GRAPH_INVALID"
    MANIFEST_DRIFT = "MANIFEST_DRIFT"
    DESTINATION_CONFLICT = "DESTINATION_CONFLICT"
    INVALID_DESTINATION = "INVALID_DESTINATION"
    UNEXPECTED_ASSETS = "UNEXPECTED_ASSETS"
    IO_FAILED = "IO_FAILED"
    SELF_TEST_FAILED = "SELF_TEST_FAILED"


class Action(StrEnum):
    INSTALL = "install"
    VERIFY = "verify"
    MANIFEST = "manifest"


@dataclass(frozen=True, slots=True)
class Rejected:
    reason: Reason
    path: str


@dataclass(frozen=True, slots=True)
class _AssetPath:
    value: str


@dataclass(frozen=True, slots=True)
class _Digest:
    value: str


@dataclass(frozen=True, slots=True)
class HashMismatch:
    path: str
    expected: _Digest
    actual: _Digest


type Failure = Rejected | HashMismatch


@dataclass(frozen=True, slots=True)
class _LockedAsset:
    path: _AssetPath
    digest: _Digest


@dataclass(frozen=True, slots=True)
class _VerifiedAsset:
    record: _LockedAsset
    data: bytes


@dataclass(frozen=True, slots=True)
class _Manifest:
    raw: bytes
    assets: tuple[_LockedAsset, ...]


@dataclass(frozen=True, slots=True)
class _Prepared:
    manifest: _Manifest
    assets: tuple[_VerifiedAsset, ...]
    agents: bytes
    digest: _Digest


@dataclass(frozen=True, slots=True)
class _VerifiedSnapshot:
    root: Path


@dataclass(frozen=True, slots=True)
class _Staged:
    root: Path
    snapshot: _VerifiedSnapshot
    prepared: _Prepared


class Status(StrEnum):
    INSTALLED = "INSTALLED"
    UNCHANGED = "UNCHANGED"
    VERIFIED = "VERIFIED"
    MANIFEST_WRITTEN = "MANIFEST_WRITTEN"
    MANIFEST_CURRENT = "MANIFEST_CURRENT"


@dataclass(frozen=True, slots=True)
class Completed:
    status: Status
    path: str
    manifest_digest: _Digest
    agents_digest: _Digest
    files: int


@dataclass(frozen=True, slots=True)
class RecoveryNeeded:
    path: str
    cause: Failure


@dataclass(frozen=True, slots=True)
class SelfTestPassed:
    checks: int


type Outcome = Completed | Failure | RecoveryNeeded | SelfTestPassed


def digest(data: bytes) -> _Digest:
    return _Digest(hashlib.sha256(data).hexdigest())


def asset_path(value: object) -> _AssetPath | Rejected:
    if (
        not isinstance(value, str)
        or not value
        or "\\" in value
        or "\x00" in value
        or PurePosixPath(value).is_absolute()
        or any(part in {"", ".", ".."} for part in value.split("/"))
    ):
        return Rejected(Reason.UNSAFE_PATH, str(value))
    return _AssetPath(value)


def mapping(value: object) -> TypeGuard[dict[str, object]]:
    return isinstance(value, dict)


def sequence(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(key)
        result[key] = value
    return result


def parse_record(value: object) -> _LockedAsset | Rejected:
    if not mapping(value) or set(value) != {"path", "sha256"}:
        return Rejected(Reason.INVALID_MANIFEST, LOCK)
    path, checksum = asset_path(value["path"]), value["sha256"]
    if isinstance(path, Rejected):
        return path
    if (
        path.value == LOCK
        or not isinstance(checksum, str)
        or not re.fullmatch("[0-9a-f]{64}", checksum)
    ):
        return Rejected(Reason.INVALID_MANIFEST, path.value)
    return _LockedAsset(path, _Digest(checksum))


def parse_records(records: object) -> tuple[_LockedAsset, ...] | Rejected:
    if not sequence(records) or not records or len(records) > MAX_FILES:
        return Rejected(Reason.INVALID_MANIFEST, LOCK)
    assets: list[_LockedAsset] = []
    names: set[str] = set()
    for record in records:
        parsed = parse_record(record)
        if isinstance(parsed, Rejected):
            return parsed
        if parsed.path.value in names:
            return Rejected(Reason.INVALID_MANIFEST, parsed.path.value)
        names.add(parsed.path.value)
        assets.append(parsed)
    if not {AGENT, GUIDE}.issubset(names):
        return Rejected(Reason.INVALID_MANIFEST, LOCK)
    return tuple(assets)


def parse_manifest(raw: bytes) -> _Manifest | Rejected:
    try:
        value: object = json.loads(raw, object_pairs_hook=unique_object)
    except (ValueError, UnicodeDecodeError):
        return Rejected(Reason.INVALID_MANIFEST, LOCK)
    if not mapping(value) or set(value) != {"type", "schemaVersion", "agent", "guide", "files"}:
        return Rejected(Reason.INVALID_MANIFEST, LOCK)
    if (
        value["type"] != "SLOPSENTRAL_GLOBAL_ASSETS"
        or type(value["schemaVersion"]) is not int
        or value["schemaVersion"] != 1
        or value["agent"] != AGENT
        or value["guide"] != GUIDE
    ):
        return Rejected(Reason.INVALID_MANIFEST, LOCK)
    assets = parse_records(value["files"])
    if isinstance(assets, Rejected):
        return assets
    return _Manifest(raw, assets)


def read_asset(root: Path, relative: _AssetPath) -> bytes | Rejected:
    path = root
    for part in relative.value.split("/"):
        path /= part
        if path.is_symlink():
            return Rejected(Reason.UNSAFE_PATH, str(path))
    try:
        descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(descriptor, "rb") as stream:
            if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                return Rejected(Reason.UNSAFE_PATH, str(path))
            data = stream.read(MAX_FILE_BYTES + 1)
    except OSError:
        return Rejected(Reason.IO_FAILED, str(path))
    if len(data) > MAX_FILE_BYTES:
        return Rejected(Reason.UNSAFE_PATH, str(path))
    return data


def verified_assets(source: Path, manifest: _Manifest) -> tuple[_VerifiedAsset, ...] | Failure:
    assets: list[_VerifiedAsset] = []
    total = 0
    for record in manifest.assets:
        data = read_asset(source, record.path)
        if isinstance(data, Rejected):
            return data
        actual = digest(data)
        if actual != record.digest:
            return HashMismatch(str(source / record.path.value), record.digest, actual)
        total += len(data)
        if total > MAX_BUNDLE_BYTES:
            return Rejected(Reason.UNSAFE_PATH, str(source))
        assets.append(_VerifiedAsset(record, data))
    return tuple(assets)


def prepare(source: Path, expected: str | None = None) -> _Prepared | Failure:
    raw = read_asset(source, _AssetPath(LOCK))
    if isinstance(raw, Rejected):
        return raw
    checksum = digest(raw)
    if expected is not None:
        if not re.fullmatch("[0-9a-f]{64}", expected):
            return Rejected(Reason.INVALID_MANIFEST, LOCK)
        if checksum.value != expected:
            return HashMismatch(LOCK, _Digest(expected), checksum)
    manifest = parse_manifest(raw)
    if isinstance(manifest, Rejected):
        return manifest
    assets = verified_assets(source, manifest)
    if isinstance(assets, (Rejected, HashMismatch)):
        return assets
    root = next(asset.data for asset in assets if asset.record.path.value == AGENT)
    footer = (
        "\n## Local reference material\n\n"
        f"Use the [source map](.slopsentral/{checksum.value}/{GUIDE}) to select supporting material.\n"
        "The snapshot preserves the linked local sources. External URLs remain citations.\n"
    ).encode()
    metadata = _VerifiedAsset(_LockedAsset(_AssetPath(LOCK), checksum), raw)
    return _Prepared(manifest, (*assets, metadata), root + footer, checksum)


def completed(status: Status, path: Path, prepared: _Prepared) -> Completed:
    return Completed(
        status, str(path), prepared.digest, digest(prepared.agents), len(prepared.assets)
    )


def tree_files(root: Path) -> set[str] | Rejected:
    if root.is_symlink() or not root.is_dir():
        return Rejected(Reason.UNSAFE_PATH, str(root))
    files: set[str] = set()
    for file in root.rglob("*"):
        if file.is_symlink():
            return Rejected(Reason.UNSAFE_PATH, str(file))
        if file.is_file():
            files.add(file.relative_to(root).as_posix())
        elif not file.is_dir():
            return Rejected(Reason.UNSAFE_PATH, str(file))
    return files


def inspect_snapshot(root: Path, prepared: _Prepared) -> _VerifiedSnapshot | Failure:
    files = tree_files(root)
    if isinstance(files, Rejected):
        return files
    if files != {asset.record.path.value for asset in prepared.assets}:
        return Rejected(Reason.UNEXPECTED_ASSETS, str(root))
    for asset in prepared.assets:
        data = read_asset(root, asset.record.path)
        if isinstance(data, Rejected):
            return data
        actual = digest(data)
        if actual != asset.record.digest:
            return HashMismatch(str(root / asset.record.path.value), asset.record.digest, actual)
    return _VerifiedSnapshot(root)


def verify(destination: Path, prepared: _Prepared) -> Completed | Failure:
    container = destination / ".slopsentral"
    if container.is_symlink() or not container.is_dir():
        return Rejected(Reason.UNSAFE_PATH, str(container))
    if {file.name for file in container.iterdir()} != {prepared.digest.value}:
        return Rejected(Reason.UNEXPECTED_ASSETS, str(container))
    inspected = inspect_snapshot(container / prepared.digest.value, prepared)
    if not isinstance(inspected, _VerifiedSnapshot):
        return inspected
    raw = read_asset(destination, _AssetPath("AGENTS.md"))
    if isinstance(raw, Rejected):
        return raw
    if digest(raw) != digest(prepared.agents):
        return HashMismatch(str(destination / "AGENTS.md"), digest(prepared.agents), digest(raw))
    return completed(Status.VERIFIED, destination, prepared)


def rollback_owned(
    container: Path, prepared: _Prepared, failure: Failure
) -> Failure | RecoveryNeeded:
    snapshot = container / prepared.digest.value
    try:
        if snapshot.exists():
            inspected = inspect_snapshot(snapshot, prepared)
            if not isinstance(inspected, _VerifiedSnapshot):
                return RecoveryNeeded(str(container), inspected)
            shutil.rmtree(snapshot)
        container.rmdir()
    except OSError:
        return RecoveryNeeded(str(container), failure)
    return failure


def publish(destination: Path, staged: _Staged) -> Outcome:
    prepared = staged.prepared
    container = destination / ".slopsentral"
    try:
        container.mkdir(mode=0o700)
    except FileExistsError:
        return Rejected(Reason.DESTINATION_CONFLICT, str(container))
    try:
        _ = staged.snapshot.root.rename(container / prepared.digest.value)
        os.link(staged.root / "AGENTS.md", destination / "AGENTS.md", follow_symlinks=False)
    except OSError:
        return rollback_owned(container, prepared, Rejected(Reason.IO_FAILED, str(destination)))
    inspected = verify(destination, prepared)
    if not isinstance(inspected, Completed):
        return RecoveryNeeded(str(container), inspected)
    return completed(Status.INSTALLED, destination, prepared)


def stage(staging: Path, prepared: _Prepared) -> _Staged | Failure:
    snapshot = staging / "snapshot"
    snapshot.mkdir()
    for asset in prepared.assets:
        path = snapshot / asset.record.path.value
        path.parent.mkdir(parents=True, exist_ok=True)
        _ = path.write_bytes(asset.data)
    _ = (staging / "AGENTS.md").write_bytes(prepared.agents)
    inspected = inspect_snapshot(snapshot, prepared)
    if not isinstance(inspected, _VerifiedSnapshot):
        return inspected
    root = read_asset(staging, _AssetPath("AGENTS.md"))
    if isinstance(root, Rejected):
        return root
    if digest(root) != digest(prepared.agents):
        return HashMismatch(str(staging / "AGENTS.md"), digest(prepared.agents), digest(root))
    return _Staged(staging, inspected, prepared)


def install(destination: Path, prepared: _Prepared) -> Outcome:
    agent, container = destination / "AGENTS.md", destination / ".slopsentral"
    if agent.is_symlink() or container.is_symlink():
        return Rejected(Reason.UNSAFE_PATH, str(destination))
    if agent.exists() or container.exists():
        if agent.is_file() and container.is_dir():
            inspected = verify(destination, prepared)
            if isinstance(inspected, Completed):
                return completed(Status.UNCHANGED, destination, prepared)
            return inspected
        return Rejected(Reason.DESTINATION_CONFLICT, str(destination))
    with tempfile.TemporaryDirectory(prefix=".slopsentral-stage-", dir=destination) as temporary:
        staged = stage(Path(temporary), prepared)
        if isinstance(staged, (Rejected, HashMismatch)):
            return staged
        return publish(destination, staged)


def link_targets(tokens: list[Token]) -> tuple[str, ...]:
    targets: list[str] = []
    for token in tokens:
        attribute = "src" if token.type == "image" else "href"
        target = token.attrGet(attribute)
        if isinstance(target, str):
            targets.append(target)
        if token.children:
            targets.extend(link_targets(token.children))
    return tuple(targets)


def local_target(origin: str, link: str) -> str | Rejected:
    parsed = urlsplit(link)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return ""
    relative = unquote(parsed.path)
    if relative.startswith("/") or "\\" in relative or "\x00" in relative:
        return Rejected(Reason.UNSAFE_PATH, link)
    return posixpath.normpath(posixpath.join(posixpath.dirname(origin), relative))


def companion_files(relative: str, inventory: frozenset[str]) -> frozenset[str]:
    parts = relative.split("/")
    if len(parts) > SKILL_ROOT_PARTS and parts[:2] == ["source", "skills"]:
        prefix = "/".join(parts[:SKILL_ROOT_PARTS]) + "/"
        return frozenset(file for file in inventory if file.startswith(prefix))
    if relative.startswith("source/concepts/type-safety/"):
        return frozenset(
            file for file in inventory if file.startswith("source/concepts/type-safety/")
        )
    return frozenset()


def references(relative: str, raw: bytes, parser: MarkdownIt) -> frozenset[str] | Rejected:
    if not relative.endswith((".md", ".mdx")):
        return frozenset()
    try:
        links = link_targets(parser.parse(raw.decode("utf-8")))
    except UnicodeDecodeError:
        return Rejected(Reason.SOURCE_GRAPH_INVALID, relative)
    targets: set[str] = set()
    for link in links:
        target = local_target(relative, link)
        if isinstance(target, Rejected):
            return target
        if target:
            targets.add(target)
    return frozenset(targets)


def collect(source: Path, inventory: frozenset[str]) -> tuple[_LockedAsset, ...] | Rejected:
    pending: set[str] = set(SEEDS)
    seen: set[str] = set()
    assets: list[_LockedAsset] = []
    parser = MarkdownIt("commonmark").enable("table")
    total = 0
    while pending:
        relative = min(pending)
        pending.remove(relative)
        if relative in seen:
            continue
        parsed = asset_path(relative)
        if isinstance(parsed, Rejected):
            return parsed
        if relative == LOCK or relative not in inventory:
            return Rejected(Reason.SOURCE_GRAPH_INVALID, relative)
        raw = read_asset(source, parsed)
        if isinstance(raw, Rejected):
            return raw
        assets.append(_LockedAsset(parsed, digest(raw)))
        total += len(raw)
        if len(assets) > MAX_FILES or total > MAX_BUNDLE_BYTES:
            return Rejected(Reason.UNSAFE_PATH, str(source))
        seen.add(relative)
        pending.update(companion_files(relative, inventory) - seen)
        targets = references(relative, raw, parser)
        if isinstance(targets, Rejected):
            return targets
        pending.update(targets - seen)
    return tuple(sorted(assets, key=lambda asset: asset.path.value))


def manifest_document(assets: tuple[_LockedAsset, ...]) -> bytes:
    return (
        json.dumps(
            {
                "type": "SLOPSENTRAL_GLOBAL_ASSETS",
                "schemaVersion": 1,
                "agent": AGENT,
                "guide": GUIDE,
                "files": [
                    {"path": asset.path.value, "sha256": asset.digest.value} for asset in assets
                ],
            },
            indent=2,
        )
        + "\n"
    ).encode()


def manifest_command(source: Path, *, write: bool) -> Outcome:
    inventory = subprocess.run(
        ["git", "-C", str(source), "ls-files", "-z"],
        capture_output=True,
        check=False,
        env={name: value for name, value in os.environ.items() if name not in GIT_SELECTORS},
    )
    if inventory.returncode != 0:
        return Rejected(Reason.SOURCE_GRAPH_INVALID, str(source))
    files = frozenset(os.fsdecode(name) for name in inventory.stdout.split(b"\0") if name)
    assets = collect(source, files)
    if isinstance(assets, Rejected):
        return assets
    raw = manifest_document(assets)
    path = source / LOCK
    if path.is_symlink():
        return Rejected(Reason.UNSAFE_PATH, str(path))
    if write:
        _ = path.write_bytes(raw)
    elif not path.is_file() or path.read_bytes() != raw:
        return Rejected(Reason.MANIFEST_DRIFT, str(path))
    return Completed(
        Status.MANIFEST_WRITTEN if write else Status.MANIFEST_CURRENT,
        str(path),
        digest(raw),
        next(asset.digest for asset in assets if asset.path.value == AGENT),
        len(assets),
    )


def encode(outcome: Outcome) -> tuple[dict[str, object], int]:
    match outcome:
        case Completed(status, path, manifest_digest, agents_digest, files):
            return {
                "type": status.value,
                "path": path,
                "manifestSha256": manifest_digest.value,
                "agentsSha256": agents_digest.value,
                "files": files,
            }, 0
        case Rejected(reason, path):
            return {"type": "REJECTED", "reason": reason.value, "path": path}, 1
        case HashMismatch(path, expected, actual):
            return {
                "type": "REJECTED",
                "reason": "SHA256_MISMATCH",
                "path": path,
                "expected": expected.value,
                "actual": actual.value,
            }, 1
        case RecoveryNeeded(path, cause):
            return {"type": "RECOVERY_NEEDED", "path": path, "cause": encode(cause)[0]}, 1
        case SelfTestPassed(checks):
            return {"type": "SELF_TEST_PASSED", "checks": checks}, 0
    assert_never(outcome)


def self_test() -> SelfTestPassed | Rejected:
    if digest(b"abc").value != "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad":
        return Rejected(Reason.SELF_TEST_FAILED, "sha256")
    if not isinstance(asset_path("../outside"), Rejected):
        return Rejected(Reason.SELF_TEST_FAILED, "unsafe-path")
    if not isinstance(parse_manifest(b"{}"), Rejected):
        return Rejected(Reason.SELF_TEST_FAILED, "invalid-manifest")
    return SelfTestPassed(3)


def destination_command(
    action: Literal[Action.INSTALL, Action.VERIFY],
    source: Path,
    destination: Path,
    expected: str | None,
) -> Outcome:
    if destination.is_symlink() or not destination.is_dir():
        return Rejected(Reason.INVALID_DESTINATION, str(destination))
    prepared = prepare(source, expected)
    if isinstance(prepared, (Rejected, HashMismatch)):
        return prepared
    match action:
        case Action.INSTALL:
            return install(destination.resolve(), prepared)
        case Action.VERIFY:
            return verify(destination.resolve(), prepared)
    assert_never(action)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("action", nargs="?", type=Action, choices=tuple(Action))
    _ = parser.add_argument("--self-test", action="store_true")
    _ = parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[1])
    _ = parser.add_argument("--destination", type=Path)
    _ = parser.add_argument("--expected-manifest-sha256")
    _ = parser.add_argument(
        "--write", action="store_true", help="Refresh the source manifest explicitly."
    )
    args = parser.parse_args()
    source: Path = args.source
    destination: Path | None = args.destination
    expected: str | None = args.expected_manifest_sha256
    write: bool = args.write
    action: Action | None = args.action
    try:
        if args.self_test:
            outcome = self_test()
        elif action is None:
            parser.error("choose install, verify, or manifest")
        elif action == Action.MANIFEST:
            if destination is not None or expected is not None:
                parser.error("manifest rejects --destination and --expected-manifest-sha256")
            outcome = manifest_command(source, write=write)
        elif destination is None or write:
            parser.error("install and verify need --destination and reject --write")
        else:
            outcome = destination_command(action, source, destination, expected)
    except OSError:
        if action == Action.INSTALL:
            outcome = RecoveryNeeded(str(destination), Rejected(Reason.IO_FAILED, str(destination)))
        else:
            outcome = Rejected(Reason.IO_FAILED, str(source))
    payload, status = encode(outcome)
    print(json.dumps(payload))
    return status


if __name__ == "__main__":
    raise SystemExit(main())
