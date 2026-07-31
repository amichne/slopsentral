from __future__ import annotations

import dataclasses
import enum
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol, Sequence


GH_AXI_PREFIX = ("npx", "-y", "gh-axi")
FAILURE_CONCLUSIONS = {
    "action_required",
    "cancelled",
    "failure",
    "startup_failure",
    "timed_out",
}
INELIGIBLE_DURATION_CONCLUSIONS = {"action_required", "cancelled", "startup_failure"}
STATE_VERSION = 1


class ObserverError(Exception):
    pass


class TransientObserverError(ObserverError):
    pass


class TargetKind(str, enum.Enum):
    RUN = "RUN"
    PR = "PR"


class WaitPredicate(str, enum.Enum):
    STATUS_CHANGE = "status-change"
    TERMINAL = "terminal"


class Outcome(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILURE = "failure"
    TIMEOUT = "timeout"
    ERROR = "error"


@dataclass(frozen=True)
class AxiResult:
    returncode: int
    stdout: str
    stderr: str


class AxiRunner(Protocol):
    def __call__(self, args: Sequence[str], cwd: Path) -> AxiResult:
        ...


@dataclass(frozen=True)
class Target:
    kind: TargetKind
    value: str
    required: bool = False


@dataclass(frozen=True)
class Snapshot:
    target: Target
    outcome: Outcome
    status: str
    conclusion: str
    summary: str
    details: dict[str, Any]

    @property
    def state_key(self) -> str:
        payload = {
            "target": dataclasses.asdict(self.target),
            "status": self.status,
            "conclusion": self.conclusion,
            "details": self.details,
        }
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))


@dataclass(frozen=True)
class TimeoutRecommendation:
    seconds: int
    source: str
    sample_count: int
    p50_seconds: int | None
    p95_seconds: int | None
    maximum_seconds: int | None


@dataclass(frozen=True)
class ActiveRequest:
    target: Target
    predicate: WaitPredicate
    baseline: Snapshot
    timeout: TimeoutRecommendation
    armed_at: str
    expires_at: str


@dataclass(frozen=True)
class DurationSample:
    repository: str
    workflow: str
    event: str
    run_id: str
    attempt: int
    conclusion: str
    run_started_at: str
    updated_at: str
    duration_seconds: int
    observed_at: str


@dataclass(frozen=True)
class WaitResult:
    target: Target
    predicate: WaitPredicate
    outcome: Outcome
    previous: Snapshot
    current: Snapshot
    polls: int
    started_at: str
    finished_at: str
    timeout: TimeoutRecommendation
    failure_logs: list[dict[str, Any]]
    error: str | None = None
