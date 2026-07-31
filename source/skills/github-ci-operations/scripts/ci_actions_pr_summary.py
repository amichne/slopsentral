from __future__ import annotations

from typing import Any

from ci_actions_scalars import normalized, parse_json, required_text
from ci_actions_types import ObserverError, Outcome, Snapshot, Target, TargetKind


def parse_pr_checks(raw: str, pr: str, *, required: bool = False) -> Snapshot:
    values = parse_json(raw, "gh pr checks")
    if not isinstance(values, list):
        raise ObserverError("gh pr checks JSON must be an array")
    checks = [parse_check(value) for value in values]
    counts = count_checks(checks)
    failed = counts.get("failed", 0)
    pending = counts.get("pending", 0)
    if failed:
        outcome = Outcome.FAILURE
        status = "completed"
        conclusion = "failure"
    elif pending:
        outcome = Outcome.PENDING
        status = "pending"
        conclusion = ""
    else:
        outcome = Outcome.SUCCESS
        status = "completed"
        conclusion = "success"
    scope = "required checks" if required else "checks"
    summary_value = ", ".join(
        f"{counts[key]} {key}"
        for key in ("passed", "failed", "pending", "skipped", "total")
    )
    return Snapshot(
        target=Target(TargetKind.PR, pr, required),
        outcome=outcome,
        status=status,
        conclusion=conclusion,
        summary=f"PR {pr} {scope}: {summary_value}",
        details={"counts": counts, "checks": checks},
    )


def parse_check(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        raise ObserverError("gh pr checks entries must be objects")
    bucket = required_text(value, "bucket", "gh pr checks").lower()
    if bucket not in {"pass", "fail", "pending", "skipping", "cancel"}:
        raise ObserverError(f"gh pr checks returned unsupported bucket: {bucket}")
    return {
        "name": required_text(value, "name", "gh pr checks"),
        "conclusion": required_text(value, "state", "gh pr checks").lower(),
        "bucket": bucket,
    }


def count_checks(checks: list[dict[str, str]]) -> dict[str, int]:
    counts = {"passed": 0, "failed": 0, "pending": 0, "skipped": 0, "total": len(checks)}
    keys = {
        "pass": "passed",
        "fail": "failed",
        "cancel": "failed",
        "pending": "pending",
        "skipping": "skipped",
    }
    for check in checks:
        counts[keys[normalized(check["bucket"])]] += 1
    return counts
