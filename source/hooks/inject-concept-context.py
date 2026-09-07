#!/usr/bin/env python3
"""Inject one bundled semantic concept into a Codex SessionStart event."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time
from typing import Final


CONCEPT_NAMES: Final[frozenset[str]] = frozenset(
    {
        "kotlin-code-correctness",
        "kotlin-repository-engineering",
        "schema-driven-design",
        "type-safety",
    }
)
SESSION_SOURCES: Final[frozenset[str]] = frozenset(
    {"startup", "resume", "clear", "compact"}
)
MAX_EVENT_BYTES: Final[int] = 64 * 1024
MAX_CONCEPT_BYTES: Final[int] = 64 * 1024
DEDUPE_WINDOW_SECONDS: Final[float] = 30.0


class HookInputError(ValueError):
    """The hook invocation does not satisfy the SessionStart contract."""


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--concept", required=True, choices=sorted(CONCEPT_NAMES))
    return parser.parse_args()


def read_event() -> dict[str, object]:
    raw_event = sys.stdin.read(MAX_EVENT_BYTES + 1)
    if len(raw_event.encode("utf-8")) > MAX_EVENT_BYTES:
        raise HookInputError("SessionStart payload exceeds the bounded input size")
    try:
        event = json.loads(raw_event)
    except json.JSONDecodeError as error:
        raise HookInputError(f"invalid SessionStart JSON: {error.msg}") from error
    if not isinstance(event, dict):
        raise HookInputError("SessionStart payload must be a JSON object")
    if event.get("hook_event_name") != "SessionStart":
        raise HookInputError("hook_event_name must be SessionStart")
    if event.get("source") not in SESSION_SOURCES:
        raise HookInputError("SessionStart source must be startup, resume, clear, or compact")
    if not isinstance(event.get("session_id"), str) or not event["session_id"]:
        raise HookInputError("SessionStart session_id must be a non-empty string")
    return event


def read_concept(plugin_root: Path, concept_name: str) -> str:
    concept_path = plugin_root / "instructions" / f"{concept_name}.md"
    try:
        concept_bytes = concept_path.read_bytes()
    except FileNotFoundError as error:
        raise HookInputError(f"missing bundled concept: {concept_name}") from error
    if len(concept_bytes) > MAX_CONCEPT_BYTES:
        raise HookInputError(f"bundled concept exceeds {MAX_CONCEPT_BYTES} bytes: {concept_name}")
    try:
        return concept_bytes.decode("utf-8")
    except UnicodeDecodeError as error:
        raise HookInputError(f"bundled concept is not UTF-8: {concept_name}") from error


def transcript_identity(event: dict[str, object]) -> str | None:
    transcript_path = event.get("transcript_path")
    if not isinstance(transcript_path, str) or not transcript_path:
        return None
    try:
        transcript = Path(transcript_path).stat()
    except OSError:
        return None
    return f"{transcript_path}\0{transcript.st_mtime_ns}\0{transcript.st_size}"


def event_fingerprint(event: dict[str, object], concept_name: str, concept: str) -> str | None:
    transcript = transcript_identity(event)
    if transcript is None:
        return None
    evidence = "\0".join(
        (
            str(event["session_id"]),
            str(event["source"]),
            transcript,
            concept_name,
            hashlib.sha256(concept.encode("utf-8")).hexdigest(),
        )
    )
    return hashlib.sha256(evidence.encode("utf-8")).hexdigest()


def claim_injection(fingerprint: str | None) -> bool:
    if fingerprint is None:
        return True
    state_root = Path(
        os.environ.get(
            "SLOPSENTRAL_CONTEXT_STATE_DIR",
            str(Path(tempfile.gettempdir()) / "slopsentral-concept-context"),
        )
    )
    try:
        state_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    except OSError:
        return True

    marker = state_root / fingerprint
    for _ in range(2):
        try:
            descriptor = os.open(marker, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            try:
                age = time.time() - marker.stat().st_mtime
                if age <= DEDUPE_WINDOW_SECONDS:
                    return False
                marker.unlink()
            except OSError:
                return True
        except OSError:
            return True
        else:
            os.close(descriptor)
            return True
    return True


def main() -> int:
    arguments = parse_arguments()
    try:
        event = read_event()
        plugin_root_value = os.environ.get("PLUGIN_ROOT")
        if not plugin_root_value:
            raise HookInputError("PLUGIN_ROOT must identify the installed plugin root")
        concept = read_concept(Path(plugin_root_value), arguments.concept)
    except HookInputError as error:
        print(f"concept context hook: {error}", file=sys.stderr)
        return 2

    fingerprint = event_fingerprint(event, arguments.concept, concept)
    if not claim_injection(fingerprint):
        return 0

    context = f"Semantic context: {arguments.concept}\n\n{concept.strip()}"
    output = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": context,
        }
    }
    print(json.dumps(output, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
