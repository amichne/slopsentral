#!/usr/bin/env python3
from __future__ import annotations

import csv
import dataclasses
import enum
import json
import re
import subprocess
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


def run_gh_axi(args: Sequence[str], cwd: Path) -> AxiResult:
    process = subprocess.run(args, cwd=cwd, text=True, capture_output=True)
    return AxiResult(process.returncode, process.stdout, process.stderr)


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
