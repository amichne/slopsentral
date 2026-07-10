from __future__ import annotations

import re

from ci_actions_scalars import normalized
from ci_actions_toon import parse_table
from ci_actions_types import FAILURE_CONCLUSIONS, ObserverError, Outcome, Snapshot, Target, TargetKind


def parse_required_pr_checks(raw: str, pr: str) -> Snapshot:
    if re.search(r"^\s*pullRequest:\s*null\s*$", raw, flags=re.MULTILINE):
        raise ObserverError(f"PR {pr} was not found by the gh-axi GraphQL API")
    if not re.search(r"^data:\s*$", raw, flags=re.MULTILINE):
        raise ObserverError("gh-axi required PR checks output is missing GraphQL data")
    checks = required_rows(parse_table(raw, "nodes"))
    counts = count_required_checks(checks)
    outcome, status, conclusion = classify_required_checks(counts)
    summary = ", ".join(
        f"{counts[key]} {key}" for key in ("passed", "failed", "pending", "total")
    )
    return Snapshot(
        target=Target(TargetKind.PR, pr, required=True),
        outcome=outcome,
        status=status,
        conclusion=conclusion,
        summary=f"PR {pr} required checks: {summary}",
        details={"counts": counts, "checks": checks},
    )


def required_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    checks: list[dict[str, str]] = []
    for row in rows:
        if normalized(row.get("isRequired")).lower() != "true":
            continue
        name = normalized(row.get("name")) or normalized(row.get("context"))
        conclusion = normalized(row.get("conclusion")) or normalized(row.get("state"))
        if not name or not conclusion:
            raise ObserverError("gh-axi required PR checks output has an incomplete check")
        checks.append({"name": name, "conclusion": conclusion.lower()})
    return checks


def count_required_checks(checks: list[dict[str, str]]) -> dict[str, int]:
    counts = {"passed": 0, "failed": 0, "pending": 0, "total": len(checks)}
    for check in checks:
        conclusion = check["conclusion"]
        if conclusion in FAILURE_CONCLUSIONS or conclusion in {"error", "fail"}:
            counts["failed"] += 1
        elif conclusion in {"expected", "pending", "queued", "in_progress"}:
            counts["pending"] += 1
        else:
            counts["passed"] += 1
    return counts


def classify_required_checks(counts: dict[str, int]) -> tuple[Outcome, str, str]:
    if counts["failed"]:
        return Outcome.FAILURE, "completed", "failure"
    if counts["pending"]:
        return Outcome.PENDING, "pending", ""
    return Outcome.SUCCESS, "completed", "success"
