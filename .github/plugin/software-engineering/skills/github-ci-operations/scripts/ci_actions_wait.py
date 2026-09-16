from __future__ import annotations

import time
from typing import Callable

from ci_actions_duration import iso_from_epoch, parse_utc
from ci_actions_types import (
    ActiveRequest,
    ObserverError,
    Outcome,
    Snapshot,
    Target,
    TransientObserverError,
    WaitPredicate,
    WaitResult,
)


def await_event(
    request: ActiveRequest,
    *,
    fetch: Callable[[Target], Snapshot],
    now_epoch: Callable[[], float] = time.time,
    sleeper: Callable[[float], None] = time.sleep,
    interval_seconds: int = 10,
    max_interval_seconds: int = 60,
) -> WaitResult:
    started_epoch = now_epoch()
    expires_epoch = parse_utc(request.expires_at).timestamp()
    current_interval = interval_seconds
    polls = 0
    consecutive_errors = 0
    latest = request.baseline
    while True:
        try:
            latest = fetch(request.target)
            consecutive_errors = 0
        except TransientObserverError as exc:
            consecutive_errors += 1
            if consecutive_errors >= 3:
                raise ObserverError(
                    f"observation failed after {consecutive_errors} attempts: {exc}"
                ) from exc
            remaining = expires_epoch - now_epoch()
            if remaining <= 0:
                return completed_wait(
                    request,
                    Outcome.TIMEOUT,
                    latest,
                    polls,
                    started_epoch,
                    now_epoch(),
                )
            sleeper(min(current_interval, remaining))
            current_interval = next_interval(current_interval, max_interval_seconds)
            continue
        polls += 1
        if event_satisfied(request, latest):
            return completed_wait(
                request,
                latest.outcome,
                latest,
                polls,
                started_epoch,
                now_epoch(),
            )
        remaining = expires_epoch - now_epoch()
        if remaining <= 0:
            return completed_wait(
                request,
                Outcome.TIMEOUT,
                latest,
                polls,
                started_epoch,
                now_epoch(),
            )
        sleeper(min(current_interval, remaining))
        current_interval = next_interval(current_interval, max_interval_seconds)


def completed_wait(
    request: ActiveRequest,
    outcome: Outcome,
    latest: Snapshot,
    polls: int,
    started_epoch: float,
    finished_epoch: float,
) -> WaitResult:
    return WaitResult(
        target=request.target,
        predicate=request.predicate,
        outcome=outcome,
        previous=request.baseline,
        current=latest,
        polls=polls,
        started_at=iso_from_epoch(started_epoch),
        finished_at=iso_from_epoch(finished_epoch),
        timeout=request.timeout,
        failure_logs=[],
    )


def next_interval(current: int, maximum: int) -> int:
    return min(maximum, max(current + 1, current * 2))


def event_satisfied(request: ActiveRequest, latest: Snapshot) -> bool:
    if request.predicate == WaitPredicate.STATUS_CHANGE:
        return latest.state_key != request.baseline.state_key
    return latest.outcome != Outcome.PENDING
