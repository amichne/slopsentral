#!/usr/bin/env -S uv run --locked --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = ["pytest==8.4.2"]
# [tool.uv]
# no-build = true
# required-version = ">=0.12.9"
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""A pure decision with a closed failure space and one explicit file adapter."""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import assert_never


class Rejection(StrEnum):
    EMPTY = "empty"
    INVALID_UTF8 = "invalid-utf8"


@dataclass(frozen=True, slots=True)
class TextSummary:
    lines: int
    characters: int


@dataclass(frozen=True, slots=True)
class Rejected:
    reason: Rejection


@dataclass(frozen=True, slots=True)
class Unreadable:
    """The adapter could not establish that the input was readable."""


type Analysis = TextSummary | Rejected
type ReadOutcome = Analysis | Unreadable


def analyze(raw: bytes) -> Analysis:
    if not raw:
        return Rejected(Rejection.EMPTY)
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return Rejected(Rejection.INVALID_UTF8)
    return TextSummary(len(text.splitlines()), len(text))


def read(source: Path) -> ReadOutcome:
    try:
        raw = source.read_bytes()
    except OSError:
        return Unreadable()
    return analyze(raw)


def encode(outcome: ReadOutcome) -> tuple[dict[str, str | int], int]:
    match outcome:
        case TextSummary(lines, characters):
            return {"type": "SUMMARY", "lines": lines, "characters": characters}, 0
        case Rejected(reason):
            return {"type": "REJECTED", "reason": reason.value}, 1
        case Unreadable():
            return {"type": "UNREADABLE"}, 1
    assert_never(outcome)


def test_valid_text() -> None:
    assert analyze("\u03b1\nb\n".encode()) == TextSummary(lines=2, characters=4)


def test_invalid_text() -> None:
    assert analyze(b"") == Rejected(Rejection.EMPTY)
    assert analyze(b"\xff") == Rejected(Rejection.INVALID_UTF8)


def test_failure_encoding() -> None:
    assert encode(Rejected(Rejection.EMPTY)) == ({"type": "REJECTED", "reason": "empty"}, 1)
    assert encode(Unreadable()) == ({"type": "UNREADABLE"}, 1)


def test_read_boundary(tmp_path: Path) -> None:
    assert read(tmp_path / "absent") == Unreadable()
    source = tmp_path / "literal $(name); with spaces.txt"
    _ = source.write_bytes(b"hi\n")
    assert read(source) == TextSummary(lines=1, characters=3)


def main(arguments: list[str]) -> int:
    if arguments == ["--self-test"]:
        import pytest  # noqa: PLC0415 -- optional execution mode, declared in PEP 723

        return int(pytest.main([str(Path(__file__).resolve()), "-q", "-o", "addopts="]))
    if arguments in (["--help"], ["-h"]):
        print("usage: standalone.py PATH | --self-test")
        return 0
    if len(arguments) != 1:
        print(json.dumps({"type": "INVALID_ARGUMENTS"}))
        return 2
    payload, status = encode(read(Path(arguments[0])))
    print(json.dumps(payload))
    return status


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
