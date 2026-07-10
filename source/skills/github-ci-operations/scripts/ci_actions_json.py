from __future__ import annotations

import dataclasses
from typing import Any

from ci_actions_types import (
    STATE_VERSION,
    ActiveRequest,
    DurationSample,
    ObserverError,
    Outcome,
    Snapshot,
    Target,
    TargetKind,
    TimeoutRecommendation,
    WaitPredicate,
    WaitResult,
)


def active_request_to_json(request: ActiveRequest) -> dict[str, Any]:
    return {
        "schemaVersion": STATE_VERSION,
        "target": target_to_json(request.target),
        "predicate": request.predicate.value,
        "baseline": snapshot_to_json(request.baseline),
        "timeout": dataclasses.asdict(request.timeout),
        "armedAt": request.armed_at,
        "expiresAt": request.expires_at,
    }


def active_request_from_json(payload: dict[str, Any]) -> ActiveRequest:
    if payload.get("schemaVersion") != STATE_VERSION:
        raise ObserverError("unsupported active observation schema version")
    timeout_payload = required_mapping(payload, "timeout")
    return ActiveRequest(
        target=target_from_json(required_mapping(payload, "target")),
        predicate=WaitPredicate(str(payload["predicate"])),
        baseline=snapshot_from_json(required_mapping(payload, "baseline")),
        timeout=TimeoutRecommendation(
            seconds=int(timeout_payload["seconds"]),
            source=str(timeout_payload["source"]),
            sample_count=int(timeout_payload["sample_count"]),
            p50_seconds=optional_int(timeout_payload.get("p50_seconds")),
            p95_seconds=optional_int(timeout_payload.get("p95_seconds")),
            maximum_seconds=optional_int(timeout_payload.get("maximum_seconds")),
        ),
        armed_at=str(payload["armedAt"]),
        expires_at=str(payload["expiresAt"]),
    )


def target_to_json(target: Target) -> dict[str, Any]:
    return {"kind": target.kind.value, "value": target.value, "required": target.required}


def target_from_json(payload: dict[str, Any]) -> Target:
    return Target(
        kind=TargetKind(str(payload["kind"])),
        value=str(payload["value"]),
        required=bool(payload.get("required", False)),
    )


def snapshot_to_json(snapshot: Snapshot) -> dict[str, Any]:
    return {
        "target": target_to_json(snapshot.target),
        "outcome": snapshot.outcome.value,
        "status": snapshot.status,
        "conclusion": snapshot.conclusion,
        "summary": snapshot.summary,
        "stateKey": snapshot.state_key,
        "details": snapshot.details,
    }


def snapshot_from_json(payload: dict[str, Any]) -> Snapshot:
    details = payload.get("details")
    if not isinstance(details, dict):
        raise ObserverError("snapshot details must be an object")
    snapshot = Snapshot(
        target=target_from_json(required_mapping(payload, "target")),
        outcome=Outcome(str(payload["outcome"])),
        status=str(payload["status"]),
        conclusion=str(payload.get("conclusion") or ""),
        summary=str(payload["summary"]),
        details=details,
    )
    expected_key = payload.get("stateKey")
    if expected_key is not None and expected_key != snapshot.state_key:
        raise ObserverError("snapshot state key does not match its content")
    return snapshot


def wait_result_to_json(result: WaitResult) -> dict[str, Any]:
    payload = {
        "schemaVersion": STATE_VERSION,
        "target": target_to_json(result.target),
        "predicate": result.predicate.value,
        "outcome": result.outcome.value,
        "previous": snapshot_to_json(result.previous),
        "current": snapshot_to_json(result.current),
        "polls": result.polls,
        "startedAt": result.started_at,
        "finishedAt": result.finished_at,
        "timeout": dataclasses.asdict(result.timeout),
        "failureLogs": result.failure_logs,
    }
    if result.error:
        payload["error"] = result.error
    return payload


def duration_sample_from_json(payload: dict[str, Any]) -> DurationSample:
    if payload.get("schemaVersion") != STATE_VERSION:
        raise ValueError("unsupported duration sample schema version")
    return DurationSample(
        repository=str(payload["repository"]),
        workflow=str(payload["workflow"]),
        event=str(payload["event"]),
        run_id=str(payload["run_id"]),
        attempt=int(payload["attempt"]),
        conclusion=str(payload["conclusion"]),
        run_started_at=str(payload["run_started_at"]),
        updated_at=str(payload["updated_at"]),
        duration_seconds=int(payload["duration_seconds"]),
        observed_at=str(payload["observed_at"]),
    )


def required_mapping(payload: dict[str, Any], key: str) -> dict[str, Any]:
    value = payload[key]
    if not isinstance(value, dict):
        raise ObserverError(f"{key} must be an object")
    return value


def optional_int(value: Any) -> int | None:
    return None if value is None else int(value)
