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
"""Measure whether a native agent routes from a repository's root guidance to its owner.

Each trial exports one Git revision with `git archive`, starts `codex exec` in a
read-only sandbox with an isolated CODEX_HOME that holds only the login, and asks
which guidance governs a maintenance task and which checks must pass. A trial
passes when the governing file was read or named and every required check appears
in the answer. Results describe routing decisions, not task execution.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from enum import StrEnum
from pathlib import Path
from typing import cast

PROMPT = (
    "Task you are about to start (do not edit anything yet): {task}\n\n"
    "Before doing it, determine which repository guidance files govern this task and which "
    "verification commands must pass before handoff. Read only what you need. "
    'Reply with only one JSON object: {{"governing_files": [...], "checks": [...]}}'
)


class Reason(StrEnum):
    TASKS_NOT_ARRAY = "tasks must be a nonempty JSON array"
    TASK_NOT_OBJECT = "each task must be an object"
    TASK_TEXT = "task id and task text must be strings"
    TASK_PATTERNS = "governing_any and checks_all need valid regex strings"
    DUPLICATE_ID = "task ids must be unique"
    CODEX_FAILED = "codex exited with a failure status"


@dataclass(frozen=True, slots=True)
class Rejected:
    reason: Reason
    detail: str = ""


@dataclass(frozen=True, slots=True)
class Task:
    id: str
    task: str
    governing_any: tuple[str, ...]
    checks_all: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Variant:
    name: str
    repository: Path
    revision: str


@dataclass(frozen=True, slots=True)
class Trial:
    variant: str
    task: str
    rep: int
    passed: bool
    reached_governing: bool
    checks_ok: bool
    input_tokens: int
    cached_input_tokens: int
    commands: int
    files_read: tuple[str, ...]


def parse_tasks(document: object) -> tuple[Task, ...] | Rejected:
    if not isinstance(document, list) or not document:
        return Rejected(Reason.TASKS_NOT_ARRAY)
    tasks: list[Task] = []
    for item in cast("list[object]", document):
        if not isinstance(item, dict):
            return Rejected(Reason.TASK_NOT_OBJECT)
        record = cast("dict[str, object]", item)
        identifier, text = record.get("id"), record.get("task")
        governing, checks = record.get("governing_any"), record.get("checks_all")
        if not isinstance(identifier, str) or not isinstance(text, str):
            return Rejected(Reason.TASK_TEXT)
        governing_patterns, check_patterns = _patterns(governing), _patterns(checks)
        if governing_patterns is None or check_patterns is None:
            return Rejected(Reason.TASK_PATTERNS, identifier)
        tasks.append(Task(identifier, text, governing_patterns, check_patterns))
    if len({task.id for task in tasks}) != len(tasks):
        return Rejected(Reason.DUPLICATE_ID)
    return tuple(tasks)


def _patterns(value: object) -> tuple[str, ...] | None:
    if not isinstance(value, list) or not value:
        return None
    patterns: list[str] = []
    for pattern in cast("list[object]", value):
        if not isinstance(pattern, str):
            return None
        try:
            _ = re.compile(pattern)
        except re.error:
            return None
        patterns.append(pattern)
    return tuple(patterns)


def files_read(commands: tuple[str, ...], tracked: tuple[str, ...]) -> tuple[str, ...]:
    """Return tracked guidance paths that appear as path tokens in executed commands."""
    text = "\n".join(commands)
    found = {
        path
        for path in tracked
        if re.search(r"(^|[\s'\"/{,=])" + re.escape(path) + r"($|[\s'\"}#,|;):])", text)
    }
    return tuple(sorted(found))


def parse_answer(message: str) -> tuple[str, str]:
    """Return the governing files and checks named by the final JSON answer."""
    match = re.search(r"\{.*\}", message, re.DOTALL)
    if match is None:
        return "", ""
    try:
        decoded = cast("object", json.loads(match.group(0)))
    except json.JSONDecodeError:
        return "", ""
    if not isinstance(decoded, dict):
        return "", ""
    answer = cast("dict[str, object]", decoded)

    def joined(key: str) -> str:
        value = answer.get(key)
        return " ".join(map(str, cast("list[object]", value))) if isinstance(value, list) else ""

    return joined("governing_files"), joined("checks")


def score(task: Task, read: tuple[str, ...], message: str) -> tuple[bool, bool]:
    governing, checks = parse_answer(message)
    reached = any(
        re.search(pattern, governing) or any(re.search(pattern, path) for path in read)
        for pattern in task.governing_any
    )
    return reached, all(re.search(pattern, checks) for pattern in task.checks_all)


def export(variant: Variant, destination: Path) -> tuple[str, ...]:
    destination.mkdir(parents=True)
    archive = subprocess.run(
        ["git", "-C", str(variant.repository), "archive", variant.revision],
        capture_output=True,
        check=True,
    ).stdout
    _ = subprocess.run(["tar", "-x", "-C", str(destination)], input=archive, check=True)
    for arguments in (
        ["git", "init", "-q"],
        ["git", "add", "-A"],
        ["git", "-c", "user.email=bench@invalid", "-c", "user.name=bench", "commit", "-qm", "x"],
    ):
        _ = subprocess.run(arguments, cwd=destination, check=True, capture_output=True)
    listed = subprocess.run(
        ["git", "ls-files", "*.md", "*.mdx"],
        cwd=destination,
        capture_output=True,
        text=True,
        check=True,
    )
    return tuple(listed.stdout.split())


def run_trial(
    variant: Variant, task: Task, rep: int, output: Path, model: str | None
) -> Trial | Rejected:
    record = output / variant.name / f"{task.id}-{rep}.json"
    if record.exists():
        return Trial(**json.loads(record.read_text()))
    auth = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")) / "auth.json"
    with tempfile.TemporaryDirectory(prefix="routing-bench-") as directory:
        root = Path(directory)
        tracked = export(variant, root / "repo")
        home = root / "home"
        home.mkdir()
        (home / "auth.json").symlink_to(auth)
        command = [
            "codex",
            "exec",
            "--json",
            "--ephemeral",
            "--skip-git-repo-check",
            "-s",
            "read-only",
            "-c",
            "model_reasoning_effort=low",
            *(["-m", model] if model else []),
            PROMPT.format(task=task.task),
        ]
        environment = {
            key: value
            for key, value in os.environ.items()
            if key not in {"OPENAI_API_KEY", "CODEX_API_KEY"}
        }
        result = subprocess.run(
            command,
            cwd=root / "repo",
            env={**environment, "CODEX_HOME": str(home)},
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=900,
            check=False,
        )
    if result.returncode:
        return Rejected(Reason.CODEX_FAILED, f"{variant.name}/{task.id}: {result.returncode}")
    commands: list[str] = []
    message = ""
    usage: dict[str, object] = {}
    for line in result.stdout.splitlines():
        try:
            event = cast("dict[str, object]", json.loads(line))
        except json.JSONDecodeError:
            continue
        item = cast("dict[str, object]", event.get("item") or {})
        if event.get("type") == "item.completed" and item.get("type") == "command_execution":
            commands.append(str(item.get("command", "")))
        elif event.get("type") == "item.completed" and item.get("type") == "agent_message":
            message = str(item.get("text", ""))
        elif event.get("type") == "turn.completed":
            usage = cast("dict[str, object]", event.get("usage") or {})
    read = files_read(tuple(commands), tracked)
    reached, checks = score(task, read, message)
    trial = Trial(
        variant.name,
        task.id,
        rep,
        reached and checks,
        reached,
        checks,
        int(cast("int", usage.get("input_tokens", 0))),
        int(cast("int", usage.get("cached_input_tokens", 0))),
        len(commands),
        read,
    )
    record.parent.mkdir(parents=True, exist_ok=True)
    _ = record.write_text(json.dumps(asdict(trial), indent=2) + "\n")
    return trial


def summarize(trials: list[Trial]) -> dict[str, object]:
    variants: dict[str, object] = {}
    for name in sorted({trial.variant for trial in trials}):
        selected = [trial for trial in trials if trial.variant == name]
        variants[name] = {
            "trials": len(selected),
            "passed": sum(trial.passed for trial in selected),
            "medianInputTokens": statistics.median(trial.input_tokens for trial in selected),
            "meanInputTokens": round(statistics.mean(trial.input_tokens for trial in selected)),
            "medianFilesRead": statistics.median(len(trial.files_read) for trial in selected),
        }
    return {"type": "ROUTING_BENCH_SUMMARY", "variants": variants}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("tasks", type=Path)
    _ = parser.add_argument("variants", nargs="+", help="NAME=REPOSITORY@REVISION")
    _ = parser.add_argument("--output", type=Path, required=True)
    _ = parser.add_argument("--reps", type=int, default=2)
    _ = parser.add_argument("--jobs", type=int, default=4)
    _ = parser.add_argument("--model")
    args = parser.parse_args()
    if shutil.which("codex") is None:
        print("routing-bench: missing dependency: codex", file=sys.stderr)
        return 69
    tasks = parse_tasks(json.loads(cast("Path", args.tasks).read_text()))
    if isinstance(tasks, Rejected):
        print(f"routing-bench: {tasks.reason.value} {tasks.detail}", file=sys.stderr)
        return 65
    variants: list[Variant] = []
    for spec in cast("list[str]", args.variants):
        name, _, location = spec.partition("=")
        repository, _, revision = location.rpartition("@")
        if not name or not repository or not revision:
            parser.error(f"variant must be NAME=REPOSITORY@REVISION: {spec}")
        variants.append(Variant(name, Path(repository).expanduser().resolve(), revision))
    output = cast("Path", args.output).resolve()
    trials: list[Trial] = []
    failures = 0
    with concurrent.futures.ThreadPoolExecutor(cast("int", args.jobs)) as pool:
        futures = [
            pool.submit(run_trial, variant, task, rep, output, cast("str | None", args.model))
            for variant in variants
            for task in tasks
            for rep in range(cast("int", args.reps))
        ]
        for future in concurrent.futures.as_completed(futures):
            try:
                outcome = future.result()
            except (subprocess.SubprocessError, OSError) as error:
                outcome = Rejected(Reason.CODEX_FAILED, repr(error))
            if isinstance(outcome, Rejected):
                failures += 1
                print(f"routing-bench: {outcome.reason.value} {outcome.detail}", file=sys.stderr)
            else:
                trials.append(outcome)
    print(json.dumps({**summarize(trials), "failedTrials": failures}, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
