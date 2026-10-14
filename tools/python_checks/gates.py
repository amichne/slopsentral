"""Finite process outcomes at the verification effect boundary."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pathlib import Path


class Stage(StrEnum):
    FORMAT = "format"
    LINT = "lint"
    TYPES = "types"
    TESTS = "tests"
    NEGATIVE_TYPES = "negative-types"
    SETUP = "setup"
    SOURCE = "source"
    PROJECTION = "projection"


@dataclass(frozen=True, slots=True)
class Command:
    stage: Stage
    executable: str
    arguments: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Completed:
    stage: Stage


@dataclass(frozen=True, slots=True)
class Failed:
    stage: Stage
    exit_code: int


@dataclass(frozen=True, slots=True)
class Unavailable:
    stage: Stage


type Outcome = Completed | Failed | Unavailable


def run(command: Command, root: Path) -> Outcome:
    print(f"check: stage={command.stage.value}", flush=True)
    try:
        result = subprocess.run(
            [command.executable, *command.arguments],
            cwd=root,
            check=False,
        )
    except OSError:
        return Unavailable(command.stage)
    if result.returncode != 0:
        return Failed(command.stage, result.returncode)
    return Completed(command.stage)


def plan() -> tuple[Command, ...]:
    return (
        Command(Stage.FORMAT, "uv", ("run", "--locked", "ruff", "format", "--check", ".")),
        Command(Stage.LINT, "uv", ("run", "--locked", "ruff", "check", ".")),
        Command(Stage.TYPES, "uv", ("run", "--locked", "pyright")),
        Command(Stage.TESTS, "uv", ("run", "--locked", "pytest")),
    )
