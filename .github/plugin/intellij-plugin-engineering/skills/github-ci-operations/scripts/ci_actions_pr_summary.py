from __future__ import annotations

from ci_actions_scalars import normalized
from ci_actions_toon import parse_check_counts, parse_table, top_level_scalar
from ci_actions_types import ObserverError, Outcome, Snapshot, Target, TargetKind


def parse_pr_checks(raw: str, pr: str, *, required: bool = False) -> Snapshot:
    summary_value = top_level_scalar(raw, "summary") or top_level_scalar(raw, "checks")
    if not summary_value:
        raise ObserverError("gh-axi pr checks output is missing summary")
    counts = parse_check_counts(summary_value)
    checks = [
        {
            "name": normalized(check.get("name")),
            "conclusion": normalized(check.get("conclusion")),
        }
        for check in parse_table(raw, "checks")
    ]
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
    return Snapshot(
        target=Target(TargetKind.PR, pr, required),
        outcome=outcome,
        status=status,
        conclusion=conclusion,
        summary=f"PR {pr} {scope}: {summary_value}",
        details={"counts": counts, "checks": checks},
    )
