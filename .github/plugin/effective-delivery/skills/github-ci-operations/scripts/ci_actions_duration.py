from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Protocol, Sequence

from ci_actions_scalars import normalized
from ci_actions_types import (
    INELIGIBLE_DURATION_CONCLUSIONS,
    DurationSample,
    ObserverError,
    TimeoutRecommendation,
)


class DurationStore(Protocol):
    def append_duration(self, sample: DurationSample) -> None:
        ...


def recommend_timeout(
    durations: Sequence[int],
    *,
    source: str,
) -> TimeoutRecommendation:
    ordered = sorted(int(value) for value in durations if int(value) >= 0)
    if not ordered:
        seconds = 1800
    elif len(ordered) < 5:
        seconds = max(ordered) * 2 + 60
    else:
        seconds = math.ceil(percentile(ordered, 0.95) * 1.5 + 60)
    return TimeoutRecommendation(
        seconds=min(3300, max(300, seconds)),
        source=source,
        sample_count=len(ordered),
        p50_seconds=percentile(ordered, 0.50) if ordered else None,
        p95_seconds=percentile(ordered, 0.95) if ordered else None,
        maximum_seconds=max(ordered) if ordered else None,
    )


def percentile(ordered: Sequence[int], quantile: float) -> int:
    if not ordered:
        raise ObserverError("cannot calculate a percentile without samples")
    rank = max(1, math.ceil(quantile * len(ordered)))
    return int(ordered[rank - 1])


def eligible_durations(samples: Sequence[DurationSample]) -> list[int]:
    return [
        sample.duration_seconds
        for sample in samples
        if normalized(sample.conclusion).lower() not in INELIGIBLE_DURATION_CONCLUSIONS
    ]


def duration_sample_from_run_api(
    details: dict[str, Any],
    *,
    repository: str,
    observed_at: str | None = None,
) -> DurationSample:
    started = parse_utc(str(details["runStartedAt"]))
    updated = parse_utc(str(details["updatedAt"]))
    duration_seconds = max(0, math.ceil((updated - started).total_seconds()))
    return DurationSample(
        repository=repository,
        workflow=str(details["workflow"]),
        event=str(details.get("event") or "unknown"),
        run_id=str(details["runId"]),
        attempt=int(details["attempt"]),
        conclusion=str(details.get("conclusion") or "unknown"),
        run_started_at=str(details["runStartedAt"]),
        updated_at=str(details["updatedAt"]),
        duration_seconds=duration_seconds,
        observed_at=observed_at or utc_now(),
    )


def record_terminal_duration(
    store: DurationStore,
    details: dict[str, Any],
    *,
    repository: str,
    observed_at: str | None = None,
) -> DurationSample:
    sample = duration_sample_from_run_api(
        details,
        repository=repository,
        observed_at=observed_at,
    )
    store.append_duration(sample)
    return sample


def parse_utc(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ObserverError(f"invalid UTC timestamp: {value}") from exc
    if parsed.tzinfo is None:
        raise ObserverError(f"UTC timestamp is missing timezone: {value}")
    return parsed.astimezone(timezone.utc)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def iso_from_epoch(value: float) -> str:
    return datetime.fromtimestamp(value, tz=timezone.utc).isoformat().replace("+00:00", "Z")
