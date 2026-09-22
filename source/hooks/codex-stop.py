#!/usr/bin/env python3
"""Adapt a check's exit status to Codex Stop without forwarding its payload.

Hook commands name both this adapter and the owning script so projections bundle
both. Ordinary script invocations retain their own CLI output and exit codes.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
import subprocess
import sys


class Outcome(str, Enum):
    COMPLETED = "completed"
    CHECK_FAILED = "check-failed"
    LAUNCH_FAILED = "launch-failed"
    INVALID_INPUT = "invalid-input"
    INVALID_OUTPUT = "invalid-output"
    CONTINUATION = "continuation-unresolved"


@dataclass(frozen=True)
class Advisory:
    count: int

    def __post_init__(self):
        if type(self.count) is not int or self.count < 0:
            raise ValueError("advisory count must be a non-negative integer")


def response(outcome: Outcome | Advisory) -> dict[str, str]:
    if isinstance(outcome, Advisory):
        return {"systemMessage": f"kotlin-stop: stage=check outcome=completed advisory-findings={outcome.count}; review layout with the checker only when relevant. These heuristics do not prove a semantic defect."}
    evidence = f"kotlin-stop: stage=check outcome={outcome.value}"
    match outcome:
        case Outcome.COMPLETED:
            return {"systemMessage": evidence + "; command completed (may have skipped); no additional build proof claimed."}
        case Outcome.CONTINUATION:
            return {"systemMessage": evidence + "; checks not rerun on continuation. Report unresolved failures unless focused verification resolved them."}
        case Outcome.CHECK_FAILED | Outcome.LAUNCH_FAILED | Outcome.INVALID_INPUT | Outcome.INVALID_OUTPUT:
            return {
                "decision": "block",
                "reason": evidence + "; inspect the configured check and native reports, resolve the failure, or report the verification limit. Do not claim green without proof.",
            }


def main() -> None:
    args = sys.argv[1:]
    advisory = args[:1] == ["--advisory"]
    if advisory:
        args = args[1:]
    try:
        payload = json.loads(sys.stdin.read(1_048_577))
    except (ValueError, OSError):
        outcome = Outcome.INVALID_INPUT
    else:
        if not isinstance(payload, dict) or type(payload.get("stop_hook_active")) is not bool:
            outcome = Outcome.INVALID_INPUT
        elif payload["stop_hook_active"]:
            outcome = Outcome.CONTINUATION
        elif len(args) < 2 or args[0] != "--":
            outcome = Outcome.INVALID_INPUT
        else:
            try:
                result = subprocess.run(
                    args[1:], stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE if advisory else subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL, check=False,
                )
            except OSError:
                outcome = Outcome.LAUNCH_FAILED
            else:
                outcome = Outcome.COMPLETED if result.returncode == 0 else Outcome.CHECK_FAILED
                if advisory and result.returncode == 0:
                    try:
                        summary = json.loads(result.stdout)
                        if (not isinstance(summary, dict) or summary.get("status") != "advisory"
                                or summary.get("ok") is not True):
                            outcome = Outcome.INVALID_OUTPUT
                        else:
                            outcome = Advisory(summary["findingCount"])
                    except (ValueError, KeyError):
                        outcome = Outcome.INVALID_OUTPUT
    print(json.dumps(response(outcome)))


if __name__ == "__main__":
    main()
