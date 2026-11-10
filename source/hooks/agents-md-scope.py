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
MAX_CONTEXT = 8 * 1024
MAX_GUIDANCE = 4 * 1024
MAX_SESSION = 256
SHA256_LENGTH = 64
STATUS_PREFIX = 3
PATH_LIMIT = 3
INSTRUCTIONS = frozenset({"AGENTS.md", "AGENTS.override.md"})
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
    scope_paths: tuple[Path, ...] = ()


@dataclass(frozen=True)
class Commit:
    sha: str
    kind: Literal["COMMIT"] = field(default="COMMIT", init=False)


@dataclass(frozen=True)
class Unborn:
    kind: Literal["UNBORN"] = field(default="UNBORN", init=False)


type Revision = Commit | Unborn


@dataclass(frozen=True)
class HistoryCheckpoint:
    size: int
    digest: str
    kind: Literal["CHECKPOINT"] = field(default="CHECKPOINT", init=False)


@dataclass(frozen=True)
class UnavailableHistory:
    kind: Literal["UNAVAILABLE"] = field(default="UNAVAILABLE", init=False)


type History = HistoryCheckpoint | UnavailableHistory


@dataclass(frozen=True)
class RemoteRefresh:
    head: Commit


@dataclass(frozen=True)
class UnattributedHeadChange:
    pass


@dataclass(frozen=True)
class UnchangedHead:
    pass


@dataclass(frozen=True)
class Snapshot:
    head: Revision
    dirty: dict[str, str]
    instructions: dict[str, str]
    history: History


@dataclass(frozen=True)
class ReviewChanges:
    local: tuple[str, ...] = ()
    unattributed: tuple[str, ...] = ()

    @property
    def paths(self) -> tuple[str, ...]:
        return tuple(sorted(set(self.local) | set(self.unattributed)))


@dataclass(frozen=True)
class Changes:
    review: ReviewChanges
    instructions: tuple[str, ...]


@dataclass(frozen=True)
class Refreshed:
    context: str
    remaining: tuple[str, ...]


@dataclass(frozen=True)
class State:
    snapshot: Snapshot
    pending: ReviewChanges
    note: str
    refresh: tuple[str, ...] = ()


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
        scoped = value.get("scope_paths", [])
        if not sequence(scoped) or not all(
            isinstance(item, str) and "\0" not in item and Path(item).is_absolute()
            for item in scoped
        ):
            return Rejected(Code.INVALID_EVENT)
        return Event(
            EventName(name),
            session,
            Path(cwd),
            tuple(Path(os.path.normpath(item)) for item in scoped if isinstance(item, str)),
        )
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


def scope_home() -> Path:
    return Path(
        os.environ.get(
            "SLOPSENTRAL_SCOPE_HOME", os.environ.get("CODEX_HOME", str(Path.home() / ".codex"))
        )
    )


def external_instructions(root: Path) -> tuple[Path, ...]:
    home = scope_home()
    ancestors = tuple(parent / name for parent in reversed(root.parents) for name in INSTRUCTIONS)
    return (*ancestors, home / "AGENTS.md", home / "AGENTS.override.md")


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


def head_history(root: Path) -> bytes | UnavailableHistory:
    location = git(root, "rev-parse", "--git-path", "logs/HEAD")
    if isinstance(location, Rejected):
        return UnavailableHistory()
    file = root / os.fsdecode(location).strip()
    try:
        if file.is_symlink():
            return UnavailableHistory()
        with file.open("rb") as stream:
            raw = stream.read(MAX_BYTES + 1)
    except OSError:
        return UnavailableHistory()
    return raw if len(raw) <= MAX_BYTES else UnavailableHistory()


def checkpoint(raw: bytes | UnavailableHistory) -> History:
    return (
        raw
        if isinstance(raw, UnavailableHistory)
        else HistoryCheckpoint(len(raw), hashlib.sha256(raw).hexdigest())
    )


def refresh_transition(line: bytes, expected: str) -> str | UnattributedHeadChange:
    fields, separator, message = line.partition(b"\t")
    old, first, rest = fields.partition(b" ")
    new, second, _identity = rest.partition(b" ")
    if not separator or not first or not second:
        return UnattributedHeadChange()
    if old != expected.encode() or not re.fullmatch(rb"[0-9a-f]{40}(?:[0-9a-f]{24})?", new):
        return UnattributedHeadChange()
    if not (
        message.startswith((b"checkout: moving from ", b"reset: moving to "))
        or (
            message.startswith((b"merge ", b"pull ", b"pull:"))
            and message.endswith(b": Fast-forward")
        )
    ):
        return UnattributedHeadChange()
    return new.decode("ascii")


def refresh_history(
    raw: bytes, before: Snapshot, after: Snapshot
) -> Commit | UnattributedHeadChange:
    if not (
        isinstance(before.head, Commit)
        and isinstance(after.head, Commit)
        and isinstance(before.history, HistoryCheckpoint)
    ):
        return UnattributedHeadChange()
    if checkpoint(raw) != after.history:
        return UnattributedHeadChange()
    size = before.history.size
    if len(raw) <= size or hashlib.sha256(raw[:size]).hexdigest() != before.history.digest:
        return UnattributedHeadChange()
    expected = before.head.sha
    for line in raw[size:].splitlines():
        transition = refresh_transition(line, expected)
        if isinstance(transition, UnattributedHeadChange):
            return transition
        expected = transition
    if expected != after.head.sha:
        return UnattributedHeadChange()
    return after.head


def remote_refresh(
    root: Path, before: Snapshot, after: Snapshot
) -> RemoteRefresh | UnattributedHeadChange:
    raw = head_history(root)
    if isinstance(raw, UnavailableHistory):
        return UnattributedHeadChange()
    transition = refresh_history(raw, before, after)
    if isinstance(transition, UnattributedHeadChange):
        return transition
    refs = git(
        root,
        "for-each-ref",
        "--format=%(refname)",
        f"--contains={transition.sha}",
        "refs/remotes/",
    )
    if isinstance(refs, Rejected) or not refs.strip():
        return UnattributedHeadChange()
    return RemoteRefresh(transition)


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
        checkpoint(head_history(root)),
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


def parse_history(value: object) -> History | Rejected:
    # Earlier state has no checkpoint. Keep its first HEAD change conservative.
    if value is None or value == {"kind": "UNAVAILABLE"}:
        return UnavailableHistory()
    if mapping(value) and value.get("kind") == "CHECKPOINT":
        size, digest = value.get("size"), value.get("digest")
        if (
            type(size) is int
            and 0 <= size <= MAX_BYTES
            and isinstance(digest, str)
            and re.fullmatch(r"[0-9a-f]{64}", digest)
        ):
            return HistoryCheckpoint(size, digest)
    return Rejected(Code.INVALID_STATE)


def load(file: Path, root: Path) -> State | Rejected:
    if file.is_symlink() or file.stat().st_size > MAX_BYTES:
        return Rejected(Code.INVALID_STATE)
    try:
        value: object = json.loads(file.read_bytes())
    except (ValueError, UnicodeDecodeError, RecursionError):
        return Rejected(Code.INVALID_STATE)
    if (
        not mapping(value)
        or type(value.get("version")) is not int
        or value.get("version") not in (1, 2)
    ):
        return Rejected(Code.INVALID_STATE)
    return parse_state(value, root)


def parse_state(value: dict[str, object], root: Path) -> State | Rejected:
    stored = value.get("snapshot")
    if not mapping(stored):
        return Rejected(Code.INVALID_STATE)
    head = parse_revision(stored.get("head"))
    history = parse_history(stored.get("history"))
    note, pending = value.get("note"), value.get("pending")
    if value.get("version") == 1:
        legacy_pending: dict[str, object] = {"local": [], "unattributed": pending}
        pending = legacy_pending
    refresh = list[str]() if value.get("version") == 1 else value.get("refresh")
    dirty, instructions = string_map(stored.get("dirty")), string_map(stored.get("instructions"))
    if isinstance(dirty, Rejected) or isinstance(instructions, Rejected):
        return Rejected(Code.INVALID_STATE)
    allowed_external = {str(path) for path in external_instructions(root)}
    if (
        isinstance(head, Rejected)
        or isinstance(history, Rejected)
        or not isinstance(note, str)
        or not mapping(pending)
        or set(pending) != {"local", "unattributed"}
    ):
        return Rejected(Code.INVALID_STATE)
    local = parse_names(pending.get("local"), allowed_external)
    unattributed = parse_names(pending.get("unattributed"), allowed_external)
    refreshed = parse_names(refresh, allowed_external)
    if (
        isinstance(local, Rejected)
        or isinstance(unattributed, Rejected)
        or isinstance(refreshed, Rejected)
    ):
        return Rejected(Code.INVALID_STATE)
    if (
        not all(authored(name) for name in dirty)
        or not all(authored(name) or name in allowed_external for name in instructions)
        or not all(PurePosixPath(name).name in INSTRUCTIONS for name in (*instructions, *refreshed))
    ):
        return Rejected(Code.INVALID_STATE)
    return State(
        Snapshot(head, dirty, instructions, history),
        ReviewChanges(local, unattributed),
        note,
        refreshed,
    )


def parse_names(value: object, allowed_external: set[str]) -> tuple[str, ...] | Rejected:
    if not sequence(value) or not all(
        isinstance(item, str) and (authored(item) or item in allowed_external) for item in value
    ):
        return Rejected(Code.INVALID_STATE)
    return tuple(sorted({item for item in value if isinstance(item, str)}))


def changed(root: Path, before: Snapshot, after: Snapshot) -> Changes | Rejected:
    candidates = set(before.dirty) | set(after.dirty)
    transition = (
        remote_refresh(root, before, after) if before.head != after.head else UnchangedHead()
    )
    committed_paths: tuple[str, ...] = ()
    if before.head != after.head and isinstance(transition, UnattributedHeadChange):
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
        committed_paths = tuple(
            name
            for name in paths(committed)
            if authored(name) and before.dirty.get(name) != fingerprint(root / name)
        )
    local = {
        name
        for name in candidates
        if authored(name) and before.dirty.get(name) != fingerprint(root / name)
    }
    instructions = tuple(
        sorted(
            name
            for name in before.instructions.keys() | after.instructions.keys()
            if before.instructions.get(name) != after.instructions.get(name)
        )
    )
    for name in instructions:
        # Only clean repository instructions can be attributed to a proven refresh.
        # Global instructions and simultaneous local edits retain their review.
        if name not in committed_paths and not (
            isinstance(transition, RemoteRefresh)
            and not Path(name).is_absolute()
            and name not in candidates
        ):
            local.add(name)
    return Changes(ReviewChanges(tuple(sorted(local)), committed_paths), instructions)


def scope(root: Path, name: str) -> str:
    if Path(name).is_absolute():
        return "AGENTS.md"
    for directory in (PurePosixPath(name).parent, *PurePosixPath(name).parent.parents):
        for filename in ("AGENTS.override.md", "AGENTS.md"):
            candidate = directory / filename
            if (root / str(candidate)).is_file():
                return str(candidate)
    return "AGENTS.md"


def grouped_scopes(root: Path, names: tuple[str, ...]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for name in names:
        groups.setdefault(scope(root, name), []).append(name)
    return groups


def guidance(root: Path, names: tuple[str, ...]) -> str:
    groups = grouped_scopes(root, names)
    lines = [
        f"AGENTS.md scope review: {len(names)} changed paths in {len(groups)} scopes.",
        "Review only task-relevant commands, ownership, and local rules. A no-change result is valid.",
        "Reuse unchanged instructions already in context. Do not read every guide or source file.",
        "Propagate a changed rule only to scopes it affects; metadata changes do not require descendant review.",
        "Create child instructions only for source-backed local differences; shared rules stay in the ancestor.",
        "Keep generated files and installed caches under their source owners.",
    ]
    for owner, paths_in_scope in groups.items():
        block = f"Scope {json.dumps(owner)}: {len(paths_in_scope)} changed paths; examples: {json.dumps(paths_in_scope[:PATH_LIMIT])}"
        if len(("\n".join(lines) + "\n" + block).encode()) > MAX_GUIDANCE - 150:
            lines.append(
                "More scopes omitted from this summary; the status command retains the full inventory."
            )
            break
        lines.append(block)
    return "\n".join(lines)


def refresh_context(
    root: Path, event: Event, names: tuple[str, ...], pending: tuple[str, ...]
) -> Refreshed | Rejected:
    directories = (
        event.cwd,
        *(file.parent for file in event.scope_paths),
        *((root / name).parent for name in pending if not Path(name).is_absolute()),
    )
    lines = [
        "Changed applicable instructions (context refresh, not an instruction-maintenance request):"
    ]
    remaining: list[str] = []
    for name in names:
        file = Path(name) if Path(name).is_absolute() else root / name
        if not Path(name).is_absolute() and not any(
            directory.is_relative_to(file.parent) for directory in directories
        ):
            remaining.append(name)
            continue
        if file.is_symlink():
            return Rejected(Code.UNSAFE_INSTRUCTION)
        if file.is_file():
            with file.open("rb") as stream:
                raw = stream.read(MAX_CONTEXT + 1)
            if len(raw) > MAX_CONTEXT:
                block = f"Read {json.dumps(name)} before further work in its scope; its content exceeds the refresh budget."
            else:
                try:
                    text = raw.decode("utf-8")
                except UnicodeDecodeError:
                    return Rejected(Code.UNSAFE_INSTRUCTION)
                block = f"Current instructions from {json.dumps(name)}:\n{text}"
                if len((lines[0] + "\n" + block).encode()) > MAX_CONTEXT:
                    block = f"Read {json.dumps(name)} before further work in its scope; its content exceeds the refresh budget."
        else:
            block = f"Instruction {json.dumps(name)} was deleted. Use the remaining ancestor instructions in this scope."
        if len(("\n".join(lines) + "\n" + block).encode()) > MAX_CONTEXT:
            remaining.append(name)
            continue
        lines.append(block)
    return Refreshed("\n".join(lines) if len(lines) > 1 else "", tuple(remaining))


def save(file: Path, state: State) -> None:
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=file.parent, delete=False
    ) as stream:
        temporary = Path(stream.name)
        try:
            _ = stream.write(json.dumps({"version": 2, **asdict(state)}, sort_keys=True) + "\n")
        finally:
            stream.close()
    try:
        _ = temporary.replace(file)
    finally:
        temporary.unlink(missing_ok=True)


def state_directory() -> Path:
    # One shared store makes user, repository, and plugin invocations idempotent.
    home = scope_home()
    return home / "state/agents-md-scope"


def review_command(event: Event, mode: Mode) -> str:
    private_runtime = os.environ.get("SLOPSENTRAL_PYTHON") == sys.executable
    launcher = (
        [sys.executable, "-I", "-B"] if private_runtime else ["uv", "run", "--locked", "--script"]
    )
    command = [
        *launcher,
        str(Path(__file__).resolve()),
        mode.value,
        "--cwd",
        str(event.cwd),
        "--session-id",
        event.session,
    ]
    if mode == Mode.REVIEW:
        command.extend(["--note", "REPLACE WITH SOURCE-BACKED REVIEW RESULT"])
    environment: list[str] = []
    if private_runtime:
        environment.append("SLOPSENTRAL_PYTHON=" + sys.executable)
    if "SLOPSENTRAL_SCOPE_HOME" in os.environ:
        environment.append("SLOPSENTRAL_SCOPE_HOME=" + str(scope_home()))
    if environment:
        command = [
            "/usr/bin/env" if private_runtime else "env",
            *environment,
            *command,
        ]
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
            save(file, State(current, ReviewChanges(), ""))
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
    pending = ReviewChanges(
        tuple(sorted(set(previous.pending.local) | set(delta.review.local))),
        tuple(sorted(set(previous.pending.unattributed) | set(delta.review.unattributed))),
    )
    refresh = tuple(sorted(set(previous.refresh) | set(delta.instructions)))
    if mode == Mode.REVIEW:
        return record_review(file, State(current, pending, note, refresh))
    if mode == Mode.STATUS:
        return {
            "type": "SCOPE_STATUS",
            "pending": pending.paths,
            "provenance": asdict(pending),
            "instructionRefreshes": refresh,
            "scopes": grouped_scopes(root, pending.paths),
            "reviewCommand": review_command(event, Mode.REVIEW),
        }
    refreshed = refresh_context(root, event, refresh, pending.paths)
    if isinstance(refreshed, Rejected):
        return refreshed
    state = State(current, pending, previous.note, refreshed.remaining)
    save(file, state)
    return hook_response(root, event, state, refreshed.context, delta.review.paths)


def record_review(file: Path, state: State) -> dict[str, object] | Rejected:
    if not state.pending.paths or not state.note.strip() or "REPLACE WITH" in state.note:
        return Rejected(Code.MISSING_REVIEW)
    # The explicit review acknowledges current instructions in its reviewed scopes.
    remaining = tuple(name for name in state.refresh if name not in state.pending.paths)
    save(file, State(state.snapshot, ReviewChanges(), state.note, remaining))
    return {"type": "REVIEW_RECORDED", "paths": len(state.pending.paths), "note": state.note}


def hook_response(
    root: Path, event: Event, state: State, context: str, delta: tuple[str, ...]
) -> dict[str, object]:
    if event.name == EventName.STOP and state.pending.paths:
        reason = "\n\n".join(filter(None, (context, guidance(root, state.pending.paths))))
        return {
            "decision": "block",
            "reason": reason
            + "\nAfter the review, record its result, including a no-change decision:\n"
            + review_command(event, Mode.REVIEW)
            + "\nFull path inventory:\n"
            + review_command(event, Mode.STATUS),
        }
    if delta:
        context = "\n\n".join(filter(None, (context, guidance(root, delta))))
        context += "\nFull path inventory:\n" + review_command(event, Mode.STATUS)
    if context:
        return {
            "hookSpecificOutput": {
                "hookEventName": event.name.value,
                "additionalContext": context,
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
