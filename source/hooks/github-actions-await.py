#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable, Sequence

SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_SCRIPTS = SCRIPT_DIR.parent / "skills/github-ci-operations/scripts"
if str(SKILL_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SKILL_SCRIPTS))

from github_actions_guard import gh_axi_command, guard_output
from github_actions_stop import CliResult, CliRunner, stop_output


AmbientRunner = Callable[[Sequence[str], Path], tuple[int, str, str]]


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
    parser = argparse.ArgumentParser(description="Guard and await AXI Actions observations.")
    parser.add_argument("command", choices=["start", "guard", "stop"])
    parser.add_argument("--repo", default=".")
    return parser


def start_output(repo_root: Path, run_cli: AmbientRunner | None = None) -> str:
    run = run_cli or ambient_runner
    exit_code, stdout, stderr = run(gh_axi_command(), repo_root)
    if exit_code == 0:
        return stdout.strip()
    detail = (stderr or stdout).strip()
    return f"gh-axi ambient context unavailable: {detail or f'exit {exit_code}'}"


def ambient_runner(args: Sequence[str], cwd: Path) -> tuple[int, str, str]:
    process = subprocess.run(args, cwd=cwd, text=True, capture_output=True)
    return process.returncode, process.stdout, process.stderr


def main() -> int:
    args = build_parser().parse_args()
    repo_root = Path(args.repo).resolve()
    if args.command == "start":
        output: str | dict[str, Any] | None = start_output(repo_root)
    elif args.command == "guard":
        output = guard_output(hook_payload())
    else:
        output = stop_output(repo_root)
    if output is not None:
        print(output if isinstance(output, str) else json.dumps(output, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
