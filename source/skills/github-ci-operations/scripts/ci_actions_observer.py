#!/usr/bin/env python3
from __future__ import annotations

import csv
import dataclasses
import enum
import json
import math
import re
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Protocol, Sequence


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


def run_gh_axi(args: Sequence[str], cwd: Path) -> AxiResult:
    process = subprocess.run(args, cwd=cwd, text=True, capture_output=True)
    return AxiResult(process.returncode, process.stdout, process.stderr)


def resolve_state_dir(
    repo_root: Path,
    git_runner: AxiRunner = run_gh_axi,
) -> Path:
    result = git_runner(
        ["git", "rev-parse", "--git-path", "axi/github-actions"],
        repo_root,
    )
    require_success(result, "git rev-parse --git-path")
    raw_path = result.stdout.strip()
    if not raw_path:
        raise ObserverError("git rev-parse --git-path returned an empty path")
    state_path = Path(raw_path)
    if not state_path.is_absolute():
        state_path = repo_root / state_path
    return state_path.resolve()


class StateStore:
    def __init__(
        self,
        repo_root: Path,
        *,
        state_dir: Path | None = None,
        git_runner: AxiRunner = run_gh_axi,
    ) -> None:
        self.repo_root = repo_root.resolve()
        self.state_dir = (state_dir or resolve_state_dir(self.repo_root, git_runner)).resolve()
        self.active_path = self.state_dir / "active.json"
        self.last_observation_path = self.state_dir / "last-observation.json"
        self.history_path = self.state_dir / "history.jsonl"

    def arm(self, request: ActiveRequest) -> None:
        if self.active_path.exists():
            raise ObserverError(
                f"an observation is already active: {self.active_path}; await or clear it first"
            )
        self._write_json(self.active_path, active_request_to_json(request))

    def load_active(self) -> ActiveRequest | None:
        if not self.active_path.exists():
            return None
        payload = self._load_json(self.active_path)
        try:
            return active_request_from_json(payload)
        except (KeyError, TypeError, ValueError, ObserverError) as exc:
            quarantined = self._quarantine(self.active_path)
            raise ObserverError(f"active observation state is corrupt: {quarantined}") from exc

    def clear_active(self) -> None:
        self.active_path.unlink(missing_ok=True)

    def write_last_observation(self, result: WaitResult) -> None:
        self._write_json(self.last_observation_path, wait_result_to_json(result))

    def append_duration(self, sample: DurationSample) -> None:
        self.history_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"schemaVersion": STATE_VERSION, **dataclasses.asdict(sample)}
        with self.history_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n")

    def load_history(self) -> list[DurationSample]:
        if not self.history_path.exists():
            return []
        samples: list[DurationSample] = []
        for line_number, raw in enumerate(
            self.history_path.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if not raw.strip():
                continue
            try:
                payload = json.loads(raw)
                samples.append(duration_sample_from_json(payload))
            except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
                raise ObserverError(
                    f"duration history is corrupt at {self.history_path}:{line_number}"
                ) from exc
        return samples

    def export_profile(self, output: Path | None = None) -> dict[str, Any]:
        destination = output or self.repo_root / ".axi/github-actions-duration-profile.json"
        profile = build_duration_profile(self.load_history())
        self._write_json(destination, profile)
        return profile

    def _write_json(self, path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + ".tmp")
        temporary.write_text(
            json.dumps(payload, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)

    def _load_json(self, path: Path) -> dict[str, Any]:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            quarantined = self._quarantine(path)
            raise ObserverError(f"state file is corrupt: {quarantined}") from exc
        if not isinstance(payload, dict):
            quarantined = self._quarantine(path)
            raise ObserverError(f"state file is corrupt: {quarantined}")
        return payload

    def _quarantine(self, path: Path) -> Path:
        timestamp = utc_now().replace("-", "").replace(":", "")
        quarantined = path.with_name(f"{path.stem}.corrupt-{timestamp}{path.suffix}")
        path.replace(quarantined)
        return quarantined


def fetch_snapshot(
    target: Target,
    repo_root: Path,
    runner: AxiRunner = run_gh_axi,
) -> Snapshot:
    if target.kind == TargetKind.RUN:
        command = [*GH_AXI_PREFIX, "run", "view", target.value]
        result = runner(command, repo_root)
        require_success(result, "gh-axi run view")
        return parse_run_view(result.stdout, target.value)

    command = [*GH_AXI_PREFIX, "pr", "checks"]
    if target.value != "current":
        command.append(target.value)
    result = runner(command, repo_root)
    require_success(result, "gh-axi pr checks")
    return parse_pr_checks(result.stdout, target.value, required=target.required)


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
    latest = request.baseline
    while True:
        latest = fetch(request.target)
        polls += 1
        if event_satisfied(request, latest):
            return WaitResult(
                target=request.target,
                predicate=request.predicate,
                outcome=latest.outcome,
                previous=request.baseline,
                current=latest,
                polls=polls,
                started_at=iso_from_epoch(started_epoch),
                finished_at=iso_from_epoch(now_epoch()),
                timeout=request.timeout,
                failure_logs=[],
            )
        remaining = expires_epoch - now_epoch()
        if remaining <= 0:
            return WaitResult(
                target=request.target,
                predicate=request.predicate,
                outcome=Outcome.TIMEOUT,
                previous=request.baseline,
                current=latest,
                polls=polls,
                started_at=iso_from_epoch(started_epoch),
                finished_at=iso_from_epoch(now_epoch()),
                timeout=request.timeout,
                failure_logs=[],
            )
        sleeper(min(current_interval, remaining))
        current_interval = min(max_interval_seconds, max(current_interval + 1, current_interval * 2))


def event_satisfied(request: ActiveRequest, latest: Snapshot) -> bool:
    if request.predicate == WaitPredicate.STATUS_CHANGE:
        return latest.state_key != request.baseline.state_key
    return latest.outcome != Outcome.PENDING


def require_success(result: AxiResult, command: str) -> None:
    if result.returncode == 0:
        return
    message = (result.stderr or result.stdout).strip()
    raise ObserverError(message or f"{command} failed with exit code {result.returncode}")


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
    details = {
        "workflow": workflow,
        "jobs": jobs,
    }
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


def parse_mapping_block(raw: str, name: str) -> dict[str, str]:
    lines = raw.splitlines()
    marker = f"{name}:"
    try:
        start = lines.index(marker)
    except ValueError as exc:
        raise ObserverError(f"gh-axi output is missing {name} block") from exc
    values: dict[str, str] = {}
    for line in lines[start + 1 :]:
        if not line.startswith("  "):
            break
        match = re.fullmatch(r"  ([A-Za-z0-9_]+):\s*(.*)", line)
        if match:
            values[match.group(1)] = decode_scalar(match.group(2))
    return values


def parse_top_level_mapping(raw: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in raw.splitlines():
        match = re.fullmatch(r"([A-Za-z0-9_]+):\s*(.*)", line)
        if match and match.group(2):
            values[match.group(1)] = decode_scalar(match.group(2))
    return values


def top_level_scalar(raw: str, key: str) -> str:
    return parse_top_level_mapping(raw).get(key, "")


def parse_table(raw: str, name: str) -> list[dict[str, str]]:
    lines = raw.splitlines()
    header_pattern = re.compile(rf"^{re.escape(name)}\[\d+\]\{{([^}}]+)\}}:$")
    for index, line in enumerate(lines):
        match = header_pattern.fullmatch(line)
        if not match:
            continue
        fields = [field.strip() for field in match.group(1).split(",")]
        rows: list[dict[str, str]] = []
        for row_line in lines[index + 1 :]:
            if not row_line.startswith("  "):
                break
            values = next(csv.reader([row_line[2:]], skipinitialspace=True))
            if len(values) != len(fields):
                raise ObserverError(f"gh-axi {name} row has unexpected field count")
            rows.append({field: decode_scalar(value) for field, value in zip(fields, values)})
        return rows
    return []


def parse_check_counts(summary: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for value, name in re.findall(r"(\d+)\s+(passed|failed|pending|skipped|total)", summary):
        counts[name] = int(value)
    if "total" not in counts:
        raise ObserverError("gh-axi pr checks summary is missing total count")
    return counts


def required_text(values: dict[str, str], key: str, source: str) -> str:
    value = normalized(values.get(key))
    if not value:
        raise ObserverError(f"{source} output is missing {key}")
    return value


def decode_scalar(value: str) -> str:
    text = value.strip()
    if text in {"", "null"}:
        return ""
    if text.startswith('"') and text.endswith('"'):
        try:
            decoded = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ObserverError(f"invalid quoted TOON scalar: {text[:80]}") from exc
        return str(decoded)
    return text


def normalized(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


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
    store: StateStore,
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


def build_duration_profile(samples: Sequence[DurationSample]) -> dict[str, Any]:
    grouped: dict[tuple[str, str, str], list[DurationSample]] = {}
    for sample in samples:
        if normalized(sample.conclusion).lower() in INELIGIBLE_DURATION_CONCLUSIONS:
            continue
        key = (sample.repository, sample.workflow, sample.event)
        grouped.setdefault(key, []).append(sample)
    groups: list[dict[str, Any]] = []
    for (repository, workflow, event), group_samples in sorted(grouped.items()):
        durations = sorted(sample.duration_seconds for sample in group_samples)
        groups.append(
            {
                "repository": repository,
                "workflow": workflow,
                "event": event,
                "sampleCount": len(durations),
                "p50Seconds": percentile(durations, 0.50),
                "p95Seconds": percentile(durations, 0.95),
                "maximumSeconds": max(durations),
                "lastObservedAt": max(sample.observed_at for sample in group_samples),
            }
        )
    observed_values = [group["lastObservedAt"] for group in groups]
    return {
        "schemaVersion": STATE_VERSION,
        "generatedAt": max(observed_values) if observed_values else None,
        "groups": groups,
    }


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
    return {
        "kind": target.kind.value,
        "value": target.value,
        "required": target.required,
    }


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
    return {
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
