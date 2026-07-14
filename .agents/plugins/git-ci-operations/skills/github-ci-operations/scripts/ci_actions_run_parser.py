from __future__ import annotations

from typing import Any, Sequence

from ci_actions_scalars import normalized, required_text
from ci_actions_toon import parse_mapping_block, parse_table, parse_top_level_mapping
from ci_actions_types import FAILURE_CONCLUSIONS, ObserverError, Outcome, Snapshot, Target, TargetKind


def parse_run_view(raw: str, run_id: str) -> Snapshot:
    run = parse_mapping_block(raw, "run")
    status = required_text(run, "status", "gh-axi run view")
    conclusion = normalized(run.get("conclusion"))
    workflow = normalized(run.get("workflow")) or f"run {run_id}"
    jobs = [
        {
            "name": normalized(job.get("name")),
            "status": normalized(job.get("status")),
            "conclusion": normalized(job.get("conclusion")),
        }
        for job in parse_table(raw, "jobs")
    ]
    details = {"workflow": workflow, "jobs": jobs}
    outcome = classify_run(status, conclusion)
    counts = count_job_states(jobs)
    count_text = ", ".join(f"{value} {key}" for key, value in sorted(counts.items()))
    state = f"{status}/{conclusion}" if conclusion else status
    summary = f"run {run_id} {workflow}: {state}"
    if count_text:
        summary += f"; {count_text}"
    return Snapshot(
        target=Target(TargetKind.RUN, run_id),
        outcome=outcome,
        status=status,
        conclusion=conclusion,
        summary=summary,
        details=details,
    )


def parse_run_api(raw: str) -> dict[str, Any]:
    values = parse_top_level_mapping(raw)
    run_id = required_text(values, "id", "gh-axi run API")
    workflow = required_text(values, "name", "gh-axi run API")
    started = required_text(values, "run_started_at", "gh-axi run API")
    updated = required_text(values, "updated_at", "gh-axi run API")
    attempt_value = required_text(values, "run_attempt", "gh-axi run API")
    try:
        attempt = int(attempt_value)
    except ValueError as exc:
        raise ObserverError("gh-axi run API run_attempt must be an integer") from exc
    return {
        "runId": run_id,
        "workflow": workflow,
        "branch": normalized(values.get("head_branch")),
        "status": normalized(values.get("status")),
        "conclusion": normalized(values.get("conclusion")),
        "event": normalized(values.get("event")),
        "createdAt": normalized(values.get("created_at")),
        "updatedAt": updated,
        "runStartedAt": started,
        "attempt": attempt,
    }


def classify_run(status: str, conclusion: str) -> Outcome:
    if normalized(status) != "completed":
        return Outcome.PENDING
    if not conclusion or normalized(conclusion) in FAILURE_CONCLUSIONS:
        return Outcome.FAILURE
    return Outcome.SUCCESS


def count_job_states(jobs: Sequence[dict[str, str]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for job in jobs:
        status = normalized(job.get("status"))
        conclusion = normalized(job.get("conclusion"))
        if status != "completed":
            key = "pending"
        elif conclusion in FAILURE_CONCLUSIONS:
            key = "failed"
        else:
            key = "passed"
        counts[key] = counts.get(key, 0) + 1
    return counts
