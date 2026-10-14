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
"""Track Git changes and request evidence-based maintenance of scoped instructions."""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass, field
from enum import StrEnum
from pathlib import Path, PurePosixPath
from typing import Literal, TypeGuard

MAX_BYTES = 16 * 1024 * 1024
MAX_CONTEXT = 24 * 1024
MAX_SESSION = 256
SHA256_LENGTH = 64
STATUS_PREFIX = 3
PATH_LIMIT = 60
INSTRUCTIONS = frozenset({"AGENTS.md", "AGENTS.override.md"})
MANIFESTS = frozenset(
    {
        "package.json",
        "pyproject.toml",
        "Cargo.toml",
        "go.mod",
        "build.gradle",
        "build.gradle.kts",
        "pom.xml",
        "plugin.json",
    }
)
GENERATED = (".agents/plugins/", ".github/plugin/")


class EventName(StrEnum):
    START = "UserPromptSubmit"
    RECORD = "PostToolUse"
    STOP = "Stop"


class Mode(StrEnum):
    HOOK = "hook"
    STATUS = "status"
    REVIEW = "review"


class Code(StrEnum):
    INVALID_EVENT = "INVALID_EVENT"
    INVALID_STATE = "INVALID_STATE"
    GIT_FAILED = "GIT_FAILED"
    IO_FAILED = "IO_FAILED"
    TOO_LARGE = "TOO_LARGE"
    UNSAFE_INSTRUCTION = "UNSAFE_INSTRUCTION"
    MISSING_REVIEW = "MISSING_REVIEW"


@dataclass(frozen=True)
class Rejected:
    code: Code


@dataclass(frozen=True)
class Event:
    name: EventName
    session: str
    cwd: Path


@dataclass(frozen=True)
class Commit:
    sha: str
    kind: Literal["COMMIT"] = field(default="COMMIT", init=False)


@dataclass(frozen=True)
class Unborn:
    kind: Literal["UNBORN"] = field(default="UNBORN", init=False)


type Revision = Commit | Unborn


@dataclass(frozen=True)
class Snapshot:
    head: Revision
    dirty: dict[str, str]
    instructions: dict[str, str]


@dataclass(frozen=True)
class State:
    snapshot: Snapshot
    pending: tuple[str, ...]
    note: str


@dataclass(frozen=True)
class Store:
    root: Path
    file: Path


@dataclass(frozen=True)
class Request:
    snapshot: Snapshot
    note: str


def mapping(value: object) -> TypeGuard[dict[str, object]]:
    return isinstance(value, dict)


def sequence(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def parse_event(raw: bytes) -> Event | Rejected:
    if len(raw) > MAX_BYTES:
        return Rejected(Code.TOO_LARGE)
    try:
        value: object = json.loads(raw)
        if not mapping(value):
            return Rejected(Code.INVALID_EVENT)
        name = value.get("hook_event_name")
        session, cwd = value.get("session_id"), value.get("cwd")
        if (
            not isinstance(name, str)
            or not isinstance(session, str)
            or not session.strip()
            or len(session) > MAX_SESSION
            or not isinstance(cwd, str)
            or not Path(cwd).is_absolute()
        ):
            return Rejected(Code.INVALID_EVENT)
        return Event(EventName(name), session, Path(cwd))
    except (ValueError, UnicodeDecodeError, RecursionError):
        return Rejected(Code.INVALID_EVENT)


def git(root: Path, *arguments: str) -> bytes | Rejected:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *arguments], capture_output=True, check=False, timeout=10
        )
    except (OSError, subprocess.TimeoutExpired):
        return Rejected(Code.GIT_FAILED)
    if result.returncode != 0:
        return Rejected(Code.GIT_FAILED)
    return result.stdout if len(result.stdout) <= MAX_BYTES else Rejected(Code.TOO_LARGE)


def safe_path(name: str) -> bool:
    path = PurePosixPath(name)
    return (
        bool(name)
        and not path.is_absolute()
        and ".." not in path.parts
        and ".git" not in path.parts
        and "\0" not in name
    )


def authored(name: str) -> bool:
    return safe_path(name) and not name.startswith(GENERATED)


def paths(raw: bytes) -> tuple[str, ...]:
    return tuple(os.fsdecode(item) for item in raw.split(b"\0") if item)


def fingerprint(file: Path) -> str:
    digest = hashlib.sha256()
    if file.is_symlink():
        digest.update(b"symlink\0" + os.fsencode(file.readlink()))
    elif file.is_file():
        digest.update(b"file\0")
        with file.open("rb") as stream:
            for chunk in iter(lambda: stream.read(65536), b""):
                digest.update(chunk)
    else:
        digest.update(b"absent\0")
    return digest.hexdigest()


def external_instructions(root: Path) -> tuple[Path, ...]:
    codex_home = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex")))
    ancestors = tuple(parent / name for parent in reversed(root.parents) for name in INSTRUCTIONS)
    return (*ancestors, codex_home / "AGENTS.md", codex_home / "AGENTS.override.md")


def dirty_paths(status: bytes) -> set[str] | Rejected:
    fields = paths(status)
    dirty: set[str] = set()
    index = 0
    while index < len(fields):
        entry = fields[index]
        index += 1
        if len(entry) <= STATUS_PREFIX:
            return Rejected(Code.GIT_FAILED)
        dirty.add(entry[STATUS_PREFIX:])
        if "R" in entry[:2] or "C" in entry[:2]:
            if index >= len(fields):
                return Rejected(Code.GIT_FAILED)
            dirty.add(fields[index])
            index += 1
    return dirty


def parse_revision(value: object) -> Revision | Rejected:
    if mapping(value):
        if value == {"kind": "UNBORN"}:
            return Unborn()
        sha = value.get("sha")
        if (
            value.get("kind") == "COMMIT"
            and isinstance(sha, str)
            and re.fullmatch(r"[0-9a-f]{40}(?:[0-9a-f]{24})?", sha)
        ):
            return Commit(sha)
    return Rejected(Code.INVALID_STATE)


def revision(root: Path) -> Revision | Rejected:
    result = git(root, "rev-parse", "--verify", "HEAD")
    if isinstance(result, Rejected):
        symbolic = git(root, "symbolic-ref", "HEAD")
        if isinstance(symbolic, Rejected):
            return symbolic
        missing = git(root, "show-ref", "--verify", os.fsdecode(symbolic).strip())
        return Unborn() if isinstance(missing, Rejected) else Rejected(Code.GIT_FAILED)
    parsed = parse_revision({"kind": "COMMIT", "sha": result.decode().strip()})
    return Rejected(Code.GIT_FAILED) if isinstance(parsed, Rejected) else parsed


def snapshot(root: Path) -> Snapshot | Rejected:
    head = revision(root)
    if isinstance(head, Rejected):
        return head
    status = git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all")
    listed = git(root, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
    if isinstance(status, Rejected) or isinstance(listed, Rejected):
        return Rejected(Code.GIT_FAILED)
    dirty = dirty_paths(status)
    if isinstance(dirty, Rejected):
        return dirty
    instruction_paths = {
        name: root / name
        for name in paths(listed)
        if authored(name) and PurePosixPath(name).name in INSTRUCTIONS
    }
    instruction_paths.update(
        {
            str(file): file
            for file in external_instructions(root)
            if file.exists() or file.is_symlink()
        }
    )
    for name, file in instruction_paths.items():
        if file.is_symlink() or (
            not Path(name).is_absolute() and not file.resolve().is_relative_to(root)
        ):
            return Rejected(Code.UNSAFE_INSTRUCTION)
    return Snapshot(
        head,
        {name: fingerprint(root / name) for name in sorted(dirty) if authored(name)},
        {name: fingerprint(file) for name, file in sorted(instruction_paths.items())},
    )


def string_map(value: object) -> dict[str, str] | Rejected:
    if not mapping(value):
        return Rejected(Code.INVALID_STATE)
    result: dict[str, str] = {}
    for key, item in value.items():
        if (
            not isinstance(item, str)
            or len(item) != SHA256_LENGTH
            or set(item) - set("0123456789abcdef")
        ):
            return Rejected(Code.INVALID_STATE)
        result[key] = item
    return result


def load(file: Path, root: Path) -> State | Rejected:
    if file.is_symlink() or file.stat().st_size > MAX_BYTES:
        return Rejected(Code.INVALID_STATE)
    try:
        value: object = json.loads(file.read_bytes())
    except (ValueError, UnicodeDecodeError, RecursionError):
        return Rejected(Code.INVALID_STATE)
    if not mapping(value) or value.get("version") != 1:
        return Rejected(Code.INVALID_STATE)
    return parse_state(value, root)


def parse_state(value: dict[str, object], root: Path) -> State | Rejected:
    stored = value.get("snapshot")
    if not mapping(stored):
        return Rejected(Code.INVALID_STATE)
    head = parse_revision(stored.get("head"))
    note, pending = value.get("note"), value.get("pending")
    dirty, instructions = string_map(stored.get("dirty")), string_map(stored.get("instructions"))
    if isinstance(dirty, Rejected) or isinstance(instructions, Rejected):
        return Rejected(Code.INVALID_STATE)
    allowed_external = {str(path) for path in external_instructions(root)}
    if (
        isinstance(head, Rejected)
        or not isinstance(note, str)
        or not sequence(pending)
        or not all(isinstance(item, str) for item in pending)
    ):
        return Rejected(Code.INVALID_STATE)
    names: tuple[str, ...] = tuple(item for item in pending if isinstance(item, str))
    if (
        not all(authored(name) for name in dirty)
        or not all(authored(name) or name in allowed_external for name in (*instructions, *names))
        or not all(PurePosixPath(name).name in INSTRUCTIONS for name in instructions)
    ):
        return Rejected(Code.INVALID_STATE)
    return State(Snapshot(head, dirty, instructions), names, note)


def changed(root: Path, before: Snapshot, after: Snapshot) -> tuple[str, ...] | Rejected:
    candidates = set(before.dirty) | set(after.dirty)
    if before.head != after.head:
        if not isinstance(after.head, Commit):
            return Rejected(Code.GIT_FAILED)
        committed = (
            git(root, "ls-tree", "-r", "--name-only", "-z", after.head.sha)
            if isinstance(before.head, Unborn)
            else git(
                root, "diff", "--name-only", "--no-renames", "-z", before.head.sha, after.head.sha
            )
        )
        if isinstance(committed, Rejected):
            return committed
        candidates.update(paths(committed))
    result = {
        name
        for name in candidates
        if authored(name) and before.dirty.get(name) != fingerprint(root / name)
    }
    result.update(
        name
        for name in before.instructions.keys() | after.instructions.keys()
        if before.instructions.get(name) != after.instructions.get(name)
    )
    return tuple(sorted(result))


def scope(root: Path, name: str) -> str:
    if Path(name).is_absolute():
        return "AGENTS.md"
    for directory in (PurePosixPath(name).parent, *PurePosixPath(name).parent.parents):
        for filename in ("AGENTS.override.md", "AGENTS.md"):
            candidate = directory / filename
            if (root / str(candidate)).is_file():
                return str(candidate)
    return "AGENTS.md"


def guidance(root: Path, names: tuple[str, ...], current: Snapshot) -> str | Rejected:
    lines = [
        "AGENTS.md scope review and propagation:",
        "Examine the source changes and inherited instructions for each affected scope.",
        "Update instructions only when commands, ownership, or local rules change.",
        "Create a child AGENTS.md only for a source-backed local difference. Keep shared rules in the ancestor.",
        "Keep generated files and installed caches under their source owners.",
    ]
    for name in names[:PATH_LIMIT]:
        lines.append(f"- {json.dumps(name)} -> review {json.dumps(scope(root, name))}")
        if PurePosixPath(name).name in MANIFESTS:
            candidate = str(PurePosixPath(name).parent / "AGENTS.md")
            lines.append(
                f"  Consider {json.dumps(candidate)} only if this scope needs local instructions."
            )
        if PurePosixPath(name).name in INSTRUCTIONS:
            prefix = str(PurePosixPath(name).parent)
            children = [
                child
                for child in current.instructions
                if not Path(child).is_absolute()
                and child != name
                and (prefix == "." or child.startswith(prefix + "/"))
            ]
            lines.append(
                "  Review descendants for propagation: " + json.dumps(children[:PATH_LIMIT])
            )
            file = Path(name) if Path(name).is_absolute() else root / name
            if file.is_file():
                if file.is_symlink():
                    return Rejected(Code.UNSAFE_INSTRUCTION)
                with file.open("rb") as stream:
                    raw = stream.read(MAX_CONTEXT + 1)
                if len(raw) > MAX_CONTEXT:
                    lines.append(
                        "  Read the current instruction file. Its content exceeds the context limit."
                    )
                else:
                    try:
                        text = raw.decode("utf-8")
                    except UnicodeDecodeError:
                        return Rejected(Code.UNSAFE_INSTRUCTION)
                    lines.append(f"  Current instructions from {json.dumps(name)}:\n{text}")
            else:
                lines.append("  The instruction file was deleted. Reassess the inherited rules.")
    if len(names) > PATH_LIMIT:
        lines.append(f"Review all {len(names)} changed paths with the status command.")
    text = "\n".join(lines)
    if len(text.encode()) > MAX_CONTEXT:
        # Keep the full path inventory in state. Never truncate an instruction's contents.
        text = (
            "AGENTS.md scope review needs more than the context limit. "
            "Use the status command to examine every affected path and read its instruction chain. "
            "Create child instructions only for source-backed local differences."
        )
    return text


def save(file: Path, state: State) -> None:
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=file.parent, delete=False
    ) as stream:
        temporary = Path(stream.name)
        try:
            _ = stream.write(json.dumps({"version": 1, **asdict(state)}, sort_keys=True) + "\n")
        finally:
            stream.close()
    try:
        _ = temporary.replace(file)
    finally:
        temporary.unlink(missing_ok=True)


def state_directory() -> Path:
    # One shared store makes user, repository, and plugin invocations idempotent.
    codex_home = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex")))
    return codex_home / "state/agents-md-scope"


def review_command(event: Event, mode: Mode) -> str:
    command = [
        "uv",
        "run",
        "--locked",
        "--script",
        str(Path(__file__).resolve()),
        mode.value,
        "--cwd",
        str(event.cwd),
        "--session-id",
        event.session,
    ]
    if mode == Mode.REVIEW:
        command.extend(["--note", "REPLACE WITH SOURCE-BACKED REVIEW RESULT"])
    return shlex.join(command)


def process(root: Path, event: Event, mode: Mode, note: str) -> dict[str, object] | Rejected:
    directory = state_directory()
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if directory.is_symlink():
        return Rejected(Code.INVALID_STATE)
    key = hashlib.sha256(os.fsencode(str(root)) + b"\0" + event.session.encode()).hexdigest()
    file = directory / f"{key}.json"
    with (directory / f"{key}.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        current = snapshot(root)
        if isinstance(current, Rejected):
            return current
        if not file.exists():
            if mode == Mode.REVIEW:
                return Rejected(Code.MISSING_REVIEW)
            save(file, State(current, (), ""))
            return (
                {}
                if event.name == EventName.START
                else {
                    "systemMessage": "BASELINE_CREATED: Earlier changes are unproved. Future changes will need a scope review."
                }
            )
        previous = load(file, root)
        if isinstance(previous, Rejected):
            return previous
        return maintain(Store(root, file), event, previous, Request(current, note), mode)


def maintain(
    store: Store, event: Event, previous: State, requested: Request, mode: Mode
) -> dict[str, object] | Rejected:
    root, file = store.root, store.file
    current, note = requested.snapshot, requested.note
    delta = changed(root, previous.snapshot, current)
    if isinstance(delta, Rejected):
        return delta
    pending = tuple(sorted(set(previous.pending) | set(delta)))
    if mode == Mode.REVIEW:
        return record_review(file, State(current, pending, note))
    if mode == Mode.STATUS:
        return {
            "type": "SCOPE_STATUS",
            "pending": pending,
            "reviewCommand": review_command(event, Mode.REVIEW),
        }
    context = guidance(root, delta, current) if delta else ""
    if isinstance(context, Rejected):
        return context
    save(file, State(current, pending, previous.note))
    return hook_response(root, event, State(current, pending, previous.note), context)


def record_review(file: Path, state: State) -> dict[str, object] | Rejected:
    if not state.pending or not state.note.strip() or "REPLACE WITH" in state.note:
        return Rejected(Code.MISSING_REVIEW)
    save(file, State(state.snapshot, (), state.note))
    return {"type": "REVIEW_RECORDED", "paths": len(state.pending), "note": state.note}


def hook_response(
    root: Path, event: Event, state: State, context: str
) -> dict[str, object] | Rejected:
    if event.name == EventName.STOP and state.pending:
        reason = guidance(root, state.pending, state.snapshot)
        if isinstance(reason, Rejected):
            return reason
        return {
            "decision": "block",
            "reason": reason
            + "\nAfter the review, record its result, including a no-change decision:\n"
            + review_command(event, Mode.REVIEW)
            + "\nFull path inventory:\n"
            + review_command(event, Mode.STATUS),
        }
    if context:
        return {
            "hookSpecificOutput": {
                "hookEventName": event.name.value,
                "additionalContext": context
                + "\nFull path inventory:\n"
                + review_command(event, Mode.STATUS),
            }
        }
    return {}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("mode", nargs="?", choices=("hook", "status", "review"), default="hook")
    _ = parser.add_argument("--cwd", type=Path)
    _ = parser.add_argument("--session-id")
    _ = parser.add_argument("--note", default="")
    args = parser.parse_args()
    event = (
        parse_event(sys.stdin.buffer.read(MAX_BYTES + 1))
        if args.mode == "hook"
        else parse_event(
            json.dumps(
                {"hook_event_name": "Stop", "cwd": str(args.cwd), "session_id": args.session_id}
            ).encode()
        )
    )
    result: dict[str, object] | Rejected
    if isinstance(event, Rejected):
        result = event
    else:
        root = git(event.cwd, "rev-parse", "--show-toplevel")
        if isinstance(root, Rejected):
            result = {
                "systemMessage": "SCOPE_SKIPPED: The current directory has no readable Git repository."
            }
        else:
            try:
                result = process(
                    Path(os.fsdecode(root).strip()).resolve(), event, Mode(args.mode), args.note
                )
            except (OSError, RuntimeError):
                result = Rejected(Code.IO_FAILED)
    if isinstance(result, Rejected):
        reason = (
            f"AGENTS.md scope maintenance failed: {result.code.value}. Review coverage is unproved."
        )
        failure = (
            {"decision": "block", "reason": reason}
            if isinstance(event, Event) and event.name == EventName.STOP
            else {"systemMessage": reason}
        )
        print(json.dumps(failure))
    else:
        print(json.dumps(result, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
