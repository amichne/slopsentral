#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = []
# [tool.uv]
# no-build = true
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""Run only explicitly configured Gradle tasks, preserving literal argv."""

from __future__ import annotations

import argparse
import os
import shlex
import subprocess
import sys
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import assert_never

sys.dont_write_bytecode = True
sys.path.insert(
    0, str(Path(__file__).resolve().parents[1] / "skills/kotlin-gradle-validation/scripts")
)
from gradle_repository import (  # noqa: E402 - delivered skill owns repository selection
    ProjectDirectory,
    ResolutionFailure,
    resolve_project_directory,
)


class SkipReason(StrEnum):
    UNCONFIGURED = "not configured; no verification claimed"
    DISABLED = "skipped by configured command"
    UNRELATED = "no Kotlin or Gradle-owned changes detected"


class RejectReason(StrEnum):
    INVALID_COMMAND = "invalid command configuration"
    INFERRED_TASK = "configure explicit Gradle tasks"
    DISCOVERY_FAILED = "change discovery failed; no verification claimed"


@dataclass(frozen=True, slots=True)
class Skip:
    reason: SkipReason


@dataclass(frozen=True, slots=True)
class Reject:
    reason: RejectReason


@dataclass(frozen=True, slots=True)
class GradleTasks:
    first: str
    rest: tuple[str, ...]


def select(spec: str, changed: tuple[str, ...]) -> GradleTasks | Skip | Reject:
    if not spec:
        return Skip(SkipReason.UNCONFIGURED)
    if spec in {"off", "skip"}:
        return Skip(SkipReason.DISABLED)
    if not any(
        Path(name).suffix in {".kt", ".kts", ".java", ".gradle"}
        or name in {"gradlew", "gradlew.bat", "gradle.properties"}
        or name.startswith(("gradle/", "buildSrc/", "build-logic/"))
        for name in changed
    ):
        return Skip(SkipReason.UNRELATED)
    try:
        arguments = shlex.split(spec)
    except ValueError:
        return Reject(RejectReason.INVALID_COMMAND)
    if not arguments or "{changedTasks}" in arguments:
        return Reject(RejectReason.INFERRED_TASK)
    return GradleTasks(arguments[0], tuple(arguments[1:]))


def discover(repo: ProjectDirectory) -> tuple[str, ...] | Reject:
    if "INTELLIGENCE_CHANGED_FILES" in os.environ:
        return tuple(os.environ["INTELLIGENCE_CHANGED_FILES"].replace(",", "\n").splitlines())
    changed: list[str] = []
    for args in (
        ("diff", "--name-only", "HEAD", "--"),
        ("ls-files", "--others", "--exclude-standard"),
    ):
        result = subprocess.run(
            ["git", "-C", str(repo.path), *args], capture_output=True, text=True, check=False
        )
        if result.returncode:
            return Reject(RejectReason.DISCOVERY_FAILED)
        changed.extend(result.stdout.splitlines())
    return tuple(changed)


def configured(repo: ProjectDirectory) -> str:
    config = Path(
        os.environ.get(
            "INTELLIGENCE_GRADLE_CHECK_COMMAND_FILE",
            str(repo.path / ".intelligence/gradle-check-command"),
        )
    )
    spec = os.environ.get("INTELLIGENCE_GRADLE_CHECK", "").strip()
    if not spec and config.exists():
        spec = next(
            (
                line.strip()
                for line in config.read_text().splitlines()
                if line.strip() and not line.lstrip().startswith("#")
            ),
            "",
        )
    return spec


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("--repo", type=Path, default=Path.cwd())
    requested: Path = parser.parse_args().repo
    repo = resolve_project_directory(requested)
    if isinstance(repo, ResolutionFailure):
        print(f"gradle-check-green: {repo.value}", file=sys.stderr)
        return 2
    wrapper = repo.path / "gradlew"
    if not wrapper.is_file() or not os.access(wrapper, os.X_OK):
        print("gradle-check-green: no executable Gradle wrapper found; skipping")
        return 0
    spec = configured(repo)
    changed = discover(repo) if spec and spec not in {"off", "skip"} else ()
    decision = changed if isinstance(changed, Reject) else select(spec, changed)
    match decision:
        case Skip(reason):
            print(f"gradle-check-green: {reason.value}")
            return 0
        case Reject(reason):
            print(f"gradle-check-green: {reason.value}", file=sys.stderr)
            return 2
        case GradleTasks(first, rest):
            return execute(repo, wrapper, GradleTasks(first, rest))
    assert_never(decision)


def execute(repo: ProjectDirectory, wrapper: Path, tasks: GradleTasks) -> int:
    arguments = (tasks.first, *tasks.rest)
    log_dir = os.environ.get("INTELLIGENCE_GRADLE_LOG_DIR", "")
    if log_dir:
        runner = (
            Path(__file__).resolve().parents[1]
            / "skills/kotlin-gradle-validation/scripts/run_gradle_task.py"
        )
        command = [
            "uv",
            "run",
            "--script",
            str(runner),
            "--repo",
            str(repo.path),
            "--task",
            arguments[0],
            "--log-dir",
            log_dir,
            "--",
            *arguments[1:],
        ]
    else:
        command = [str(wrapper), "--console=plain", *arguments]
    return subprocess.run(command, cwd=repo.path, check=False).returncode


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except OSError:
        print("gradle-check-green: effect unavailable", file=sys.stderr)
        raise SystemExit(2) from None
