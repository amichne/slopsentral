#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Sequence


RAW_GITHUB_COMMAND = re.compile(
    r"(?:^|[;&|]\s*)gh\s+"
    r"(?:api|auth|issue|pr|release|repo|run|secret|variable|workflow)\b"
)


@dataclass(frozen=True)
class CliResult:
    exit_code: int
    payload: dict[str, Any]


CliRunner = Callable[[Sequence[str]], CliResult]


def guard_output(payload: dict[str, Any]) -> dict[str, Any] | None:
    tool_name = str(payload.get("tool_name") or payload.get("toolName") or "")
    normalized_tool = tool_name.lower()
    if normalized_tool.startswith("mcp__") and "github" in normalized_tool:
        return deny("Use npx -y gh-axi as the sole GitHub interaction surface.")
    command = hook_command(payload)
    if command and RAW_GITHUB_COMMAND.search(command):
        return deny(
            "Raw gh commands are disabled for this plugin; use npx -y gh-axi and "
            "arm the AXI CI observer instead of polling."
        )
    return None


def stop_output(
    repo_root: Path,
    run_cli: CliRunner | None = None,
) -> dict[str, Any]:
    cli = run_cli or observer_cli_runner(repo_root)
    status = cli(["--repo", str(repo_root), "status", "--json"])
    if status.exit_code != 0:
        return continuation("observer-status-error", status.payload)
    if status.payload.get("state") == "idle":
        return {"continue": True}
    event = cli(["--repo", str(repo_root), "await", "--json"])
    return continuation("observation-event", event.payload)


def continuation(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "decision": "block",
        "reason": f"GitHub Actions {kind}:\n{compact_event(payload)}",
    }


def compact_event(payload: dict[str, Any]) -> str:
    target = payload.get("target") if isinstance(payload.get("target"), dict) else {}
    previous = payload.get("previous") if isinstance(payload.get("previous"), dict) else {}
    current = payload.get("current") if isinstance(payload.get("current"), dict) else {}
    lines = [
        f"outcome: {payload.get('outcome', 'unknown')}",
        f"predicate: {payload.get('predicate', 'unknown')}",
    ]
    if target:
        lines.append(f"target: {target.get('kind', 'unknown')} {target.get('value', 'unknown')}")
    if previous.get("summary"):
        lines.append(f"previous: {previous['summary']}")
    if current.get("summary"):
        lines.append(f"current: {current['summary']}")
    if payload.get("polls") is not None:
        lines.append(f"polls: {payload['polls']}")
    if payload.get("finishedAt"):
        lines.append(f"observedAt: {payload['finishedAt']}")
    if payload.get("error"):
        lines.append(f"error: {payload['error']}")
    return "\n".join(lines)


def deny(message: str) -> dict[str, Any]:
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": message,
        },
        "systemMessage": message,
    }


def hook_command(payload: dict[str, Any]) -> str:
    raw_input = payload.get("tool_input") or payload.get("toolInput") or {}
    if isinstance(raw_input, str):
        try:
            raw_input = json.loads(raw_input)
        except json.JSONDecodeError:
            return raw_input
    if not isinstance(raw_input, dict):
        return ""
    for key in ("command", "cmd", "bash"):
        value = raw_input.get(key)
        if isinstance(value, str):
            return value
    return ""


def observer_cli_path() -> Path:
    return (
        Path(__file__).resolve().parents[1]
        / "skills/github-ci-operations/scripts/ci_wait_for_actions"
    )


def observer_cli_runner(repo_root: Path) -> CliRunner:
    script = observer_cli_path()

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
            payload = {
                "outcome": "error",
                "error": f"observer returned invalid JSON: {raw[:200]}",
            }
        if not isinstance(payload, dict):
            payload = {"outcome": "error", "error": "observer JSON must be an object"}
        return CliResult(process.returncode, payload)

    return run


def hook_payload() -> dict[str, Any]:
    raw = os.environ.get("HOOK_INPUT", "").strip() or sys.stdin.read().strip()
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Guard and await AXI GitHub Actions observations.")
    parser.add_argument("command", choices=["guard", "stop"])
    parser.add_argument("--repo", default=".")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "guard":
        output = guard_output(hook_payload())
    else:
        output = stop_output(Path(args.repo).resolve())
    if output is not None:
        print(json.dumps(output, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
