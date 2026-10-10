#!/usr/bin/env python3
"""Read canonical bundled policy; emit Codex SessionStart context without writes."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
import hashlib
import json
import os
from pathlib import Path
import sys


MAX_EVENT_BYTES = 64 * 1024
MAX_CONTEXT_BYTES = 8 * 1024


class InstructionName(str, Enum):
    AGENT_EXECUTION = "agent-execution"
    ENGINEERING_DESIGN = "engineering-design"
    KOTLIN_ENGINEERING = "kotlin-engineering"
    API_CONTRACT_DESIGN = "api-contract-design"


class SessionSource(str, Enum):
    STARTUP = "startup"
    RESUME = "resume"
    CLEAR = "clear"
    COMPACT = "compact"


class FailureCode(str, Enum):
    INVALID_SELECTION = "INVALID_SELECTION"
    INVALID_EVENT = "INVALID_EVENT"
    EVENT_TOO_LARGE = "EVENT_TOO_LARGE"
    INVALID_PLUGIN_ROOT = "INVALID_PLUGIN_ROOT"
    POLICY_UNAVAILABLE = "POLICY_UNAVAILABLE"
    POLICY_ESCAPES_ROOT = "POLICY_ESCAPES_ROOT"
    INVALID_POLICY = "INVALID_POLICY"
    CONTEXT_TOO_LARGE = "CONTEXT_TOO_LARGE"


@dataclass(frozen=True)
class Failure:
    code: FailureCode


@dataclass(frozen=True)
class Selection:
    names: tuple[InstructionName, ...]


@dataclass(frozen=True)
class SessionStart:
    source: SessionSource


@dataclass(frozen=True)
class Policy:
    name: InstructionName
    text: str


@dataclass(frozen=True)
class Context:
    text: str
    policies: tuple[Policy, ...]


def select(arguments: list[str]) -> Selection | Failure:
    if not arguments or len(arguments) % 2:
        return Failure(FailureCode.INVALID_SELECTION)
    names = []
    for option, value in zip(arguments[::2], arguments[1::2]):
        if option != "--instruction":
            return Failure(FailureCode.INVALID_SELECTION)
        try:
            name = InstructionName(value)
        except ValueError:
            return Failure(FailureCode.INVALID_SELECTION)
        if name in names:
            return Failure(FailureCode.INVALID_SELECTION)
        names.append(name)
    return Selection(tuple(names))


def parse_event(raw: bytes) -> SessionStart | Failure:
    if len(raw) > MAX_EVENT_BYTES:
        return Failure(FailureCode.EVENT_TOO_LARGE)
    try:
        event = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError):
        return Failure(FailureCode.INVALID_EVENT)
    if not isinstance(event, dict) or event.get("hook_event_name") != "SessionStart":
        return Failure(FailureCode.INVALID_EVENT)
    if not isinstance(event.get("session_id"), str) or not event["session_id"].strip():
        return Failure(FailureCode.INVALID_EVENT)
    try:
        source = SessionSource(event.get("source"))
    except (ValueError, TypeError):
        return Failure(FailureCode.INVALID_EVENT)
    return SessionStart(source)


def read_policy(root: Path, name: InstructionName) -> Policy | Failure:
    file = root / "instructions" / f"{name.value}.md"
    try:
        if not file.resolve().is_relative_to(root.resolve()):
            return Failure(FailureCode.POLICY_ESCAPES_ROOT)
        with file.open("rb") as stream:
            raw = stream.read(MAX_CONTEXT_BYTES + 1)
    except (OSError, RuntimeError):
        return Failure(FailureCode.POLICY_UNAVAILABLE)
    if len(raw) > MAX_CONTEXT_BYTES:
        return Failure(FailureCode.CONTEXT_TOO_LARGE)
    try:
        text = raw.decode("utf-8").strip()
    except UnicodeDecodeError:
        return Failure(FailureCode.INVALID_POLICY)
    if not text:
        return Failure(FailureCode.INVALID_POLICY)
    return Policy(name, text)


def compose(policies: tuple[Policy, ...]) -> Context | Failure:
    text = "\n\n".join(policy.text for policy in policies)
    if len(text.encode("utf-8")) > MAX_CONTEXT_BYTES:
        return Failure(FailureCode.CONTEXT_TOO_LARGE)
    return Context(text, policies)


def deliver(selection: Selection) -> Context | Failure:
    root_value = os.environ.get("PLUGIN_ROOT")
    if not root_value or not Path(root_value).is_absolute() or not Path(root_value).is_dir():
        return Failure(FailureCode.INVALID_PLUGIN_ROOT)
    policies = []
    for name in selection.names:
        policy = read_policy(Path(root_value), name)
        if isinstance(policy, Failure):
            return policy
        policies.append(policy)
    return compose(tuple(policies))


def emit(result: Context | Failure) -> None:
    if isinstance(result, Failure):
        reason = f"Instruction context unavailable: {result.code.value}. Required policy was not delivered."
        output = {"continue": False, "stopReason": reason, "systemMessage": reason}
        evidence = {"type": "INSTRUCTION_CONTEXT_FAILED", "code": result.code.value}
    else:
        output = {"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": result.text}}
        evidence = {
            "type": "INSTRUCTION_CONTEXT_EMITTED",
            "instructions": [policy.name.value for policy in result.policies],
            "bytes": len(result.text.encode("utf-8")),
            "sha256": hashlib.sha256(result.text.encode("utf-8")).hexdigest(),
        }
    print(json.dumps(output, ensure_ascii=False))
    print(json.dumps(evidence), file=sys.stderr)


def main() -> int:
    selection = select(sys.argv[1:])
    if isinstance(selection, Failure):
        emit(selection)
        return 0
    event = parse_event(sys.stdin.buffer.read(MAX_EVENT_BYTES + 1))
    emit(event if isinstance(event, Failure) else deliver(selection))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
