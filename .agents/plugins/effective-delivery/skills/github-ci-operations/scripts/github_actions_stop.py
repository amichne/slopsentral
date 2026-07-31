from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Sequence


@dataclass(frozen=True)
class CliResult:
    exit_code: int
    payload: dict[str, Any]


CliRunner = Callable[[Sequence[str]], CliResult]


def stop_output(
    repo_root: Path,
    run_cli: CliRunner | None = None,
) -> dict[str, Any] | None:
    cli = run_cli or observer_cli_runner(repo_root)
    status = cli(["--repo", str(repo_root), "status", "--json"])
    if status.exit_code != 0:
        return continuation("observer-status-error", status.payload)
    if status.payload.get("state") == "idle":
        return None
    event = cli(["--repo", str(repo_root), "await", "--json"])
    return continuation("observation-event", event.payload)


def continuation(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {"decision": "block", "reason": f"GitHub Actions {kind}:\n{compact_event(payload)}"}


def compact_event(payload: dict[str, Any]) -> str:
    target = mapping(payload.get("target"))
    previous = mapping(payload.get("previous"))
    current = mapping(payload.get("current"))
    lines = [
        f"outcome: {payload.get('outcome', 'unknown')}",
        f"predicate: {payload.get('predicate', 'unknown')}",
    ]
    append_value(lines, "target", target_text(target))
    append_value(lines, "previous", previous.get("summary"))
    append_value(lines, "current", current.get("summary"))
    append_value(lines, "polls", payload.get("polls"))
    append_value(lines, "observedAt", payload.get("finishedAt"))
    append_value(lines, "error", payload.get("error"))
    return "\n".join(lines)


def mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def target_text(target: dict[str, Any]) -> str | None:
    if not target:
        return None
    return f"{target.get('kind', 'unknown')} {target.get('value', 'unknown')}"


def append_value(lines: list[str], label: str, value: Any) -> None:
    if value is not None and value != "":
        lines.append(f"{label}: {value}")


def observer_cli_runner(repo_root: Path) -> CliRunner:
    script = Path(__file__).resolve().parent / "ci_wait_for_actions"

    def run(args: Sequence[str]) -> CliResult:
        process = subprocess.run(
            [sys.executable, str(script), *args],
            cwd=repo_root,
            text=True,
            capture_output=True,
        )
        raw = (process.stdout or process.stderr).strip()
        try:
            payload = json.loads(raw or "{}")
        except json.JSONDecodeError:
            payload = {"outcome": "error", "error": f"invalid observer JSON: {raw[:200]}"}
        if not isinstance(payload, dict):
            payload = {"outcome": "error", "error": "observer JSON must be an object"}
        return CliResult(process.returncode, payload)

    return run
