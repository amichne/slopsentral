#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_SCRIPTS = SCRIPT_DIR.parent / "skills/github-ci-operations/scripts"
if str(SKILL_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SKILL_SCRIPTS))

from github_actions_guard import guard_output
from github_actions_stop import CliResult, CliRunner, stop_output


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
    parser.add_argument("command", choices=["guard", "stop"])
    parser.add_argument("--repo", default=".")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    output = (
        guard_output(hook_payload())
        if args.command == "guard"
        else stop_output(Path(args.repo).resolve())
    )
    if output is not None:
        print(json.dumps(output, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
