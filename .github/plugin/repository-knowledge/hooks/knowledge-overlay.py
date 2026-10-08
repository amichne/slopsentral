#!/usr/bin/env python3
"""Load explicitly registered repository knowledge guidance without writes."""
from __future__ import annotations

import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/code-knowledge-base/scripts'))
from knowledge_overlay import Failure, FailureCode, Knowledge, NoOverlay, context, select_knowledge, unique_object

MAX_EVENT_BYTES = 64 * 1024


def read_event(raw: bytes) -> Path | Failure:
    if len(raw) > MAX_EVENT_BYTES:
        return Failure(FailureCode.INVALID_EVENT)
    try:
        event = json.loads(raw.decode('utf-8'), object_pairs_hook=unique_object)
    except (UnicodeError, ValueError, RecursionError):
        return Failure(FailureCode.INVALID_EVENT)
    if not isinstance(event, dict) or event.get('hook_event_name') != 'SessionStart' or not isinstance(event.get('source'), str) or event.get('source') not in {'startup', 'resume', 'clear', 'compact'}:
        return Failure(FailureCode.INVALID_EVENT)
    if not isinstance(event.get('session_id'), str) or not event['session_id'].strip():
        return Failure(FailureCode.INVALID_EVENT)
    directory = event.get('cwd')
    if not isinstance(directory, str) or not directory or '\0' in directory or not Path(directory).is_absolute():
        return Failure(FailureCode.INVALID_EVENT)
    return Path(directory)


def emit(result: Knowledge | Failure | NoOverlay) -> None:
    if isinstance(result, Knowledge):
        text = context(result)
        if isinstance(text, Failure):
            emit(text)
            return
        output = {'hookSpecificOutput': {'hookEventName': 'SessionStart', 'additionalContext': text}}
        evidence = {'type': 'KNOWLEDGE_OVERLAY', 'stage': 'context', 'outcome': 'LOADED', 'mode': result.mode.value, 'bytes': len(text.encode('utf-8'))}
    elif isinstance(result, Failure):
        output = {'systemMessage': f'Knowledge overlay unavailable: {result.code.value}. Do not infer a storage destination or generate knowledge until the configured overlay is valid.'}
        evidence = {'type': 'KNOWLEDGE_OVERLAY', 'stage': result.stage.value, 'outcome': 'FAILED', 'code': result.code.value}
    else:
        output = {}
        evidence = {'type': 'KNOWLEDGE_OVERLAY', 'stage': 'selection', 'outcome': result.value}
    print(json.dumps(output))
    print(json.dumps(evidence), file=sys.stderr)


def main() -> int:
    event = read_event(sys.stdin.buffer.read(MAX_EVENT_BYTES + 1))
    emit(event if isinstance(event, Failure) else select_knowledge(event))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
