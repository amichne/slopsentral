from __future__ import annotations

from typing import Any, Sequence

from ci_actions_duration import percentile
from ci_actions_scalars import normalized
from ci_actions_types import INELIGIBLE_DURATION_CONCLUSIONS, STATE_VERSION, DurationSample


def build_duration_profile(samples: Sequence[DurationSample]) -> dict[str, Any]:
    grouped: dict[tuple[str, str, str], list[DurationSample]] = {}
    for sample in samples:
        if normalized(sample.conclusion).lower() in INELIGIBLE_DURATION_CONCLUSIONS:
            continue
        key = (sample.repository, sample.workflow, sample.event)
        grouped.setdefault(key, []).append(sample)
    groups = [profile_group(key, values) for key, values in sorted(grouped.items())]
    observed_values = [group["lastObservedAt"] for group in groups]
    return {
        "schemaVersion": STATE_VERSION,
        "generatedAt": max(observed_values) if observed_values else None,
        "groups": groups,
    }


def profile_group(
    key: tuple[str, str, str],
    samples: list[DurationSample],
) -> dict[str, Any]:
    repository, workflow, event = key
    durations = sorted(sample.duration_seconds for sample in samples)
    return {
        "repository": repository,
        "workflow": workflow,
        "event": event,
        "sampleCount": len(durations),
        "p50Seconds": percentile(durations, 0.50),
        "p95Seconds": percentile(durations, 0.95),
        "maximumSeconds": max(durations),
        "lastObservedAt": max(sample.observed_at for sample in samples),
    }
