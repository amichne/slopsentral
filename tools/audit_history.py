"""Read native Pi and Codex session evidence."""

from __future__ import annotations

import json
import subprocess
from collections import Counter, defaultdict
from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import StrEnum
from itertools import islice
from typing import TYPE_CHECKING, Literal, TypeGuard

if TYPE_CHECKING:
    from collections.abc import Iterable, Iterator
    from pathlib import Path


type Json = None | bool | int | float | str | list[Json] | dict[str, Json]
type Record = dict[str, Json]
type Row = tuple[int, Record]
type Outcome = Literal["ok", "error", "unknown"]
type Kind = Literal["message", "tool_call", "tool_result", "usage", "context", "turn", "error"]


class Source(StrEnum):
    PI = "pi"
    CODEX = "codex"


class HistoryError(ValueError):
    pass


@dataclass(frozen=True)
class Event:
    line: int
    kind: Kind
    facts: Record
    details: Record = field(default_factory=dict[str, Json])

    def view(self, *, details: bool) -> Record:
        return {
            "line": self.line,
            "kind": self.kind,
            **self.facts,
            **(self.details if details else {}),
        }


@dataclass(frozen=True)
class History:
    source: Source
    identity: str
    events: tuple[Event, ...]
    incomplete_line: int | None


def is_record(value: object) -> TypeGuard[Record]:
    # Use only after JSON decoding, which establishes string keys and JSON values.
    return isinstance(value, dict)


def obj(value: Json) -> Record:
    return value if isinstance(value, dict) else {}


def items(value: Json) -> list[Json]:
    return value if isinstance(value, list) else []


def string(value: Json) -> str | None:
    return value if isinstance(value, str) else None


def texts(value: Json) -> list[str]:
    if isinstance(value, str):
        return [value]
    blocks = (obj(block) for block in items(value))
    return [
        text
        for block in blocks
        if block.get("type") in ("text", "input_text", "output_text", "Text")
        and (text := string(block.get("text"))) is not None
    ]


def select(data: Record, **names: str) -> Record:
    return {key: data[name] for key, name in names.items() if data.get(name) is not None}


@contextmanager
def log_lines(path: Path) -> Iterator[Iterable[str]]:
    if path.suffix != ".zst":
        with path.open(encoding="utf-8") as stream:
            yield stream
        return
    with subprocess.Popen(
        ["zstd", "-dc", "--", str(path)],
        stdout=subprocess.PIPE,
        encoding="utf-8",
    ) as process:
        if process.stdout is None:
            msg = "zstd did not provide a stream"
            raise HistoryError(msg)
        with process.stdout:
            yield process.stdout
        if process.wait() != 0:
            msg = f"cannot decompress {path}"
            raise HistoryError(msg)


def load_history(path: Path, leaf: str | None = None) -> History:
    rows: list[Row] = []
    incomplete_line = None
    with log_lines(path) as stream:
        for number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            try:
                raw: object = json.loads(line)
            except json.JSONDecodeError as error:
                if rows and not line.endswith("\n"):
                    incomplete_line = number
                    break
                msg = f"invalid JSON at line {number}"
                raise HistoryError(msg) from error
            if not is_record(raw):
                msg = f"expected a JSON object at line {number}"
                raise HistoryError(msg)
            rows.append((number, raw))
    if rows:
        header = rows[0][1]
        match header.get("type"):
            case "session":
                return History(
                    Source.PI,
                    identity(header),
                    tuple(pi_events(pi_branch(rows[1:], header.get("version", 1), leaf))),
                    incomplete_line,
                )
            case "session_meta" if leaf is None:
                return History(
                    Source.CODEX,
                    identity(obj(header.get("payload"))),
                    tuple(codex_events(rows[1:])),
                    incomplete_line,
                )
            case "session_meta":
                msg = "--leaf applies to Pi sessions"
                raise HistoryError(msg)
            case _:
                pass
    msg = "unsupported session header"
    raise HistoryError(msg)


def identity(header: Record) -> str:
    identifier = string(header.get("id"))
    if not identifier:
        msg = "session header has no id"
        raise HistoryError(msg)
    return identifier


def pi_branch(rows: list[Row], version: Json, leaf: str | None) -> Iterable[Row]:
    if version == 1 and leaf is None:
        return rows
    if version not in (2, 3):
        msg = f"unsupported Pi tree version: {version}"
        raise HistoryError(msg)
    by_id: dict[str, Row] = {}
    last = None
    for row in rows:
        identifier = string(row[1].get("id"))
        if identifier is not None:
            if identifier in by_id:
                msg = f"duplicate Pi entry id at line {row[0]}"
                raise HistoryError(msg)
            by_id[identifier] = row
            last = identifier
    cursor = last if leaf is None else leaf
    branch: list[Row] = []
    visited: set[str] = set()
    while cursor is not None:
        if cursor in visited or cursor not in by_id:
            msg = f"unknown or cyclic Pi entry: {cursor}"
            raise HistoryError(msg)
        row = by_id[cursor]
        branch.append(row)
        visited.add(cursor)
        cursor = string(row[1].get("parentId"))
    return reversed(branch)


def message_event(line: int, facts: Record, role: str, content: list[str]) -> Event:
    return Event(line, "message", {**facts, "role": role}, {"text": "\n".join(content)})


def outcome(value: Json, *, error_flag: bool = False) -> Outcome:
    if not isinstance(value, bool):
        return "unknown"
    return "ok" if value != error_flag else "error"


def pi_events(rows: Iterable[Row]) -> Iterator[Event]:
    for line, entry in rows:
        facts = select(entry, timestamp="timestamp", entryId="id")
        match entry.get("type"):
            case "compaction":
                yield Event(
                    line,
                    "context",
                    {**facts, "change": "compaction", **select(entry, tokensBefore="tokensBefore")},
                )
            case "custom_message":
                yield pi_custom_context(line, facts, entry)
            case "message":
                yield from pi_message_events(line, facts, obj(entry.get("message")))
            case _:
                pass


def pi_message_events(line: int, facts: Record, message: Record) -> Iterator[Event]:
    role = message.get("role")
    content = texts(message.get("content"))
    match role:
        case "system":
            yield pi_system_context(line, facts, message)
        case "user" | "assistant":
            if content:
                yield message_event(line, facts, role, content)
            if role == "assistant":
                yield from pi_assistant(line, facts, message)
        case "custom" | "hookMessage":
            yield pi_custom_context(line, facts, message)
        case "toolResult":
            yield Event(
                line,
                "tool_result",
                {
                    **facts,
                    **select(
                        message, tool="toolName", callId="toolCallId", durationMs="durationMs"
                    ),
                    "outcome": outcome(message.get("isError"), error_flag=True),
                },
                {"text": "\n".join(content)},
            )
        case _:
            pass


def pi_system_context(line: int, facts: Record, message: Record) -> Event:
    sections = obj(message.get("sections"))
    return Event(
        line,
        "context",
        {
            **facts,
            "change": "system",
            "sectionChars": {
                key: len(value) if isinstance(value, str) else None
                for key, value in sections.items()
            },
            "toolsAdded": [
                name
                for item in items(message.get("toolsAdded"))
                if (name := string(obj(item).get("name")))
            ],
            "toolsRemoved": items(message.get("toolsRemoved")),
        },
        {"sections": sections},
    )


def pi_custom_context(line: int, facts: Record, entry: Record) -> Event:
    content = "\n".join(texts(entry.get("content")))
    return Event(
        line,
        "context",
        {
            **facts,
            "change": "custom_message",
            "textChars": len(content),
            **select(entry, customType="customType", display="display"),
        },
        {"text": content},
    )


def pi_assistant(line: int, facts: Record, message: Record) -> Iterator[Event]:
    usage = obj(message.get("usage"))
    if usage:
        yield Event(
            line,
            "usage",
            {
                **facts,
                **select(
                    message,
                    model="model",
                    provider="provider",
                    durationMs="durationMs",
                    stopReason="stopReason",
                ),
                "scope": "response",
                "tokens": select(
                    usage,
                    input="input",
                    output="output",
                    cacheRead="cacheRead",
                    cacheWrite="cacheWrite",
                    total="totalTokens",
                ),
                **select(obj(usage.get("cost")), costUsd="total"),
            },
        )
    if message.get("stopReason") in ("error", "aborted"):
        yield Event(
            line,
            "error",
            {**facts, **select(message, status="stopReason")},
            select(message, text="errorMessage"),
        )
    for item in items(message.get("content")):
        block = obj(item)
        if block.get("type") == "toolCall":
            yield Event(
                line,
                "tool_call",
                {
                    **facts,
                    **select(block, tool="name", callId="id"),
                },
                select(block, arguments="arguments"),
            )


def codex_output(output: Json) -> Record:
    body = obj(output).get("content", output)
    text = texts(body)
    return {"text": "\n".join(text)} if text else {}


def codex_response(line: int, facts: Record, item: Record) -> Iterator[Event]:
    match item.get("type"):
        case "message":
            role = item.get("role")
            if role in ("user", "assistant"):
                content = [
                    text
                    for text in texts(item.get("content"))
                    if not (
                        role == "user"
                        and text.lstrip().startswith(
                            (
                                "<environment_context>",
                                "# AGENTS.md instructions",
                                "<permissions instructions>",
                            ),
                        )
                    )
                ]
                if content:
                    yield message_event(
                        line, {**facts, **select(item, phase="phase")}, role, content
                    )
        case "function_call" | "custom_tool_call" | "tool_search_call":
            name = string(item.get("name")) or "tool_search"
            namespace = string(item.get("namespace"))
            yield Event(
                line,
                "tool_call",
                {
                    **facts,
                    **select(item, callId="call_id"),
                    "tool": f"{namespace}.{name}" if namespace else name,
                },
                select(item, arguments="arguments", input="input"),
            )
        case "function_call_output" | "custom_tool_call_output" | "tool_search_output":
            output = item.get("output")
            yield Event(
                line,
                "tool_result",
                {
                    **facts,
                    **select(item, callId="call_id"),
                    "outcome": outcome(obj(output).get("success")),
                },
                codex_output(output),
            )

        case _:
            pass


def codex_events(rows: list[Row]) -> Iterator[Event]:
    native_usage = any(entry.get("type") == "token_usage_record" for _, entry in rows)
    for line, entry in rows:
        payload = obj(entry.get("payload"))
        facts = select(entry, timestamp="timestamp")
        match entry.get("type"):
            case "response_item":
                yield from codex_response(line, facts, payload)
            case "turn_context":
                yield Event(
                    line,
                    "context",
                    {**facts, **select(payload, turnId="turn_id", model="model", effort="effort")},
                )
            case "token_usage_record":
                yield codex_usage(line, facts, obj(payload.get("usage")), "response")
            case "event_msg":
                kind = payload.get("type")
                if kind == "token_count" and not native_usage:
                    usage = obj(obj(payload.get("info")).get("total_token_usage"))
                    if usage:
                        yield codex_usage(line, facts, usage, "session")
                if kind in (
                    "task_started",
                    "task_complete",
                    "turn_started",
                    "turn_complete",
                    "turn_aborted",
                ):
                    yield Event(
                        line,
                        "turn",
                        {
                            **facts,
                            "status": kind,
                            **select(
                                payload,
                                turnId="turn_id",
                                durationMs="duration_ms",
                                timeToFirstTokenMs="time_to_first_token_ms",
                            ),
                        },
                    )
                if kind == "error":
                    yield Event(line, "error", facts, select(payload, text="message"))

            case _:
                pass


def codex_usage(line: int, facts: Record, usage: Record, scope: str) -> Event:
    return Event(
        line,
        "usage",
        {
            **facts,
            "scope": scope,
            "tokens": select(
                usage,
                input="input_tokens",
                output="output_tokens",
                cacheRead="cached_input_tokens",
                cacheWrite="cache_write_input_tokens",
                reasoningOutput="reasoning_output_tokens",
                total="total_tokens",
            ),
        },
    )


def name_tools(events: Iterable[Event]) -> Iterator[Event]:
    names: dict[str, Json] = {}
    for event in events:
        identifier = string(event.facts.get("callId"))
        if identifier and event.kind == "tool_call":
            names[identifier] = event.facts.get("tool")
        if identifier in names and event.kind == "tool_result" and "tool" not in event.facts:
            yield Event(
                event.line, event.kind, {**event.facts, "tool": names[identifier]}, event.details
            )
        else:
            yield event


def summary(history: History, events: tuple[Event, ...]) -> Record:
    tools: dict[str, Counter[str]] = defaultdict(Counter)
    results = {
        identifier: event.facts.get("outcome")
        for event in events
        if event.kind == "tool_result" and (identifier := string(event.facts.get("callId")))
    }
    total: Counter[str] = Counter()
    scope = None
    cost = None
    for event in events:
        if event.kind == "tool_call":
            name = string(event.facts.get("tool")) or "(unnamed)"
            identifier = string(event.facts.get("callId"))
            state = results.get(identifier, "missing") if identifier else "missing"
            tools[name]["calls"] += 1
            tools[name][string(state) or "unknown"] += 1
        if event.kind == "usage":
            scope = event.facts.get("scope")
            tokens = {
                key: value
                for key, value in obj(event.facts.get("tokens")).items()
                if type(value) is int
            }
            if scope == "session":
                total = Counter(tokens)
            else:
                total.update(tokens)
            value = event.facts.get("costUsd")
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                cost = (cost or 0.0) + value
    return {
        "schemaVersion": 1,
        "source": history.source,
        "sessionId": history.identity,
        "incompleteLine": history.incomplete_line,
        "counts": dict(Counter(event.kind for event in events)),
        "tools": {
            name: {state: counts[state] for state in ("calls", "ok", "error", "unknown", "missing")}
            for name, counts in sorted(tools.items())
        },
        "usage": {"scope": scope, "tokens": dict(total), "costUsd": cost},
    }


def history_view(
    history: History,
    view: str,
    after_line: int,
    limit: int,
    *,
    details: bool,
) -> Record:
    events = tuple(name_tools(history.events))
    if view == "summary":
        return summary(history, events)
    kinds = {
        "tools": {"tool_call", "tool_result"},
        "messages": {"message"},
        "context": {"context"},
        "usage": {"usage"},
    }
    matching = (
        event
        for event in events
        if event.line > after_line and (view == "events" or event.kind in kinds[view])
    )
    page = list(islice(matching, limit))
    extra = next(matching, None)
    # One native line can emit several normalized events. Keep those on one page.
    while extra is not None and extra.line == page[-1].line:
        page.append(extra)
        extra = next(matching, None)
    return {
        "schemaVersion": 1,
        "source": history.source,
        "sessionId": history.identity,
        "incompleteLine": history.incomplete_line,
        "events": [event.view(details=details) for event in page],
        "nextAfterLine": page[-1].line if extra is not None else None,
    }
