#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


SUCCESS_VALUES = {
    "success",
    "successful",
    "pass",
    "passed",
    "skipped",
    "skip",
    "neutral",
}
FAILURE_VALUES = {
    "failure",
    "failed",
    "fail",
    "error",
    "cancelled",
    "canceled",
    "timed_out",
    "timedout",
    "action_required",
    "startup_failure",
}
PENDING_VALUES = {
    "pending",
    "queued",
    "requested",
    "waiting",
    "in_progress",
    "in-progress",
    "running",
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate GitHub CI evidence from gh JSON output.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    pr_checks = subparsers.add_parser("pr-checks", help="Validate gh pr checks JSON.")
    pr_checks.add_argument("--input", required=True, help="Path to gh pr checks JSON, or - for stdin.")
    pr_checks.add_argument("--allow-pending", action="store_true", help="Exit 0 when checks are pending.")
    pr_checks.add_argument("--allow-empty", action="store_true", help="Exit 0 when no checks are present.")
    pr_checks.set_defaults(func=check_pr_checks)

    run = subparsers.add_parser("run", help="Validate gh run view JSON.")
    run.add_argument("--input", required=True, help="Path to gh run view JSON, or - for stdin.")
    run.add_argument("--allow-pending", action="store_true", help="Exit 0 when the run is still pending.")
    run.set_defaults(func=check_run)

    args = parser.parse_args(argv)
    return args.func(args)


def check_pr_checks(args: argparse.Namespace) -> int:
    payload = read_json(args.input)
    checks = normalize_checks_payload(payload)
    findings: list[str] = []
    failures: list[dict[str, str]] = []
    pending: list[dict[str, str]] = []
    unknown: list[dict[str, str]] = []
    successes = 0

    if not checks and not args.allow_empty:
        findings.append("no PR checks were present")

    for index, check in enumerate(checks):
        if not isinstance(check, dict):
            findings.append(f"checks[{index}] must be an object")
            continue
        name = str(check.get("name") or check.get("workflow") or f"checks[{index}]")
        bucket = normalize_value(check.get("bucket"))
        state = normalize_value(check.get("state") or check.get("conclusion") or check.get("status"))
        classification = classify(bucket, state)
        record = {
            "name": name,
            "state": state or bucket or "unknown",
            "bucket": bucket or "",
            "link": str(check.get("link") or check.get("url") or ""),
        }
        if classification == "success":
            successes += 1
        elif classification == "failure":
            failures.append(record)
        elif classification == "pending":
            pending.append(record)
        else:
            unknown.append(record)

    if failures:
        findings.append(f"{len(failures)} check(s) are failing")
    if pending and not args.allow_pending:
        findings.append(f"{len(pending)} check(s) are pending")
    if unknown:
        findings.append(f"{len(unknown)} check(s) have unknown state")

    conclusion = "GREEN"
    if failures:
        conclusion = "FAILING"
    elif pending:
        conclusion = "PENDING"
    elif unknown or findings:
        conclusion = "UNKNOWN"

    output = {
        "ok": not findings,
        "conclusion": conclusion,
        "total": len(checks),
        "successes": successes,
        "failures": failures,
        "pending": pending,
        "unknown": unknown,
        "findings": findings,
    }
    print(json.dumps(output, indent=2, sort_keys=True))
    return 0 if not findings else 1


def check_run(args: argparse.Namespace) -> int:
    payload = read_json(args.input)
    if not isinstance(payload, dict):
        raise SystemExit("run input must be a JSON object")
    status = normalize_value(payload.get("status"))
    conclusion = normalize_value(payload.get("conclusion"))
    findings: list[str] = []

    if status == "completed":
        if conclusion not in SUCCESS_VALUES:
            findings.append(f"completed run conclusion is not green: {conclusion or 'missing'}")
    elif status in PENDING_VALUES:
        if not args.allow_pending:
            findings.append(f"run is still pending: {status}")
    else:
        findings.append(f"run status is unknown: {status or 'missing'}")

    output = {
        "ok": not findings,
        "name": payload.get("name") or payload.get("workflowName"),
        "url": payload.get("url"),
        "headSha": payload.get("headSha"),
        "status": status,
        "conclusion": conclusion,
        "findings": findings,
    }
    print(json.dumps(output, indent=2, sort_keys=True))
    return 0 if not findings else 1


def normalize_checks_payload(payload: Any) -> list[Any]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("checks", "items", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    raise SystemExit("PR checks input must be a JSON array or object containing a checks array")


def classify(bucket: str, state: str) -> str:
    values = [value for value in (bucket, state) if value]
    if any(value in FAILURE_VALUES for value in values):
        return "failure"
    if any(value in PENDING_VALUES for value in values):
        return "pending"
    if any(value in SUCCESS_VALUES for value in values):
        return "success"
    return "unknown"


def normalize_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().lower().replace(" ", "_")


def read_json(path: str) -> Any:
    try:
        text = sys.stdin.read() if path == "-" else Path(path).read_text(encoding="utf-8")
        return json.loads(text)
    except FileNotFoundError as error:
        raise SystemExit(f"input file does not exist: {path}") from error
    except json.JSONDecodeError as error:
        raise SystemExit(f"input is invalid JSON: {path}: {error}") from error


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
