#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from shutil import which
from typing import Any, Callable, Protocol, Sequence

FAILURE_CONCLUSIONS = {
    "action_required",
    "cancelled",
    "failure",
    "startup_failure",
    "timed_out",
}
FAILURE_CHECK_BUCKETS = {"cancel", "fail"}
PENDING_CHECK_BUCKETS = {"pending"}
PENDING_STATES = {"expected", "pending", "queued", "requested", "waiting", "in_progress"}
TERMINAL_RUN_STATUS = "completed"
DEFAULT_FIELDS = [
    "attempt",
    "conclusion",
    "createdAt",
    "databaseId",
    "displayTitle",
    "event",
    "headBranch",
    "headSha",
    "jobs",
    "name",
    "startedAt",
    "status",
    "updatedAt",
    "url",
    "workflowName",
]
CHECK_FIELDS = [
    "bucket",
    "completedAt",
    "event",
    "link",
    "name",
    "startedAt",
    "state",
    "workflow",
]


@dataclass(frozen=True)
class GhResult:
    returncode: int
    stdout: str
    stderr: str


class GhRunner(Protocol):
    def __call__(self, args: Sequence[str], cwd: Path) -> GhResult:
        ...


@dataclass(frozen=True)
class Observation:
    outcome: str
    state_key: str
    summary: str
    data: dict[str, Any]
    failing_run_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class Transition:
    observedAt: str
    previousSummary: str | None
    summary: str
    stateKey: str


@dataclass(frozen=True)
class WaitResult:
    target: dict[str, Any]
    outcome: str
    polls: int
    startedAt: str
    finishedAt: str
    transitions: list[Transition]
    final: dict[str, Any]
    failureLogs: list[dict[str, Any]]


class WaitError(Exception):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Wait for a GitHub Actions run or PR checks with backoff and "
            "transition-only output."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--run-id", help="GitHub Actions run database ID to wait for.")
    target.add_argument(
        "--pr",
        nargs="?",
        const="",
        help="PR number, URL, or branch. Omit the value to use the current branch PR.",
    )
    parser.add_argument("--repo", default=".", help="Path inside the target Git repository.")
    parser.add_argument(
        "--required",
        action="store_true",
        help="With --pr, wait only for required checks.",
    )
    parser.add_argument("--interval", type=positive_int, default=10)
    parser.add_argument("--max-interval", type=positive_int, default=60)
    parser.add_argument(
        "--timeout",
        type=non_negative_int,
        default=1800,
        help="Maximum seconds to wait. Use 0 for no timeout.",
    )
    parser.add_argument(
        "--failure-log-lines",
        type=non_negative_int,
        default=120,
        help="Failed log tail lines to capture once terminal failure is observed.",
    )
    parser.add_argument(
        "--no-failure-logs",
        action="store_true",
        help="Do not fetch failed logs after terminal failure.",
    )
    parser.add_argument(
        "--evidence",
        type=Path,
        help="Write a JSON evidence file with transitions and final state.",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON evidence to stdout.")
    parser.add_argument("--quiet", action="store_true", help="Suppress transition output.")
    args = parser.parse_args()
    if args.max_interval < args.interval:
        parser.error("--max-interval must be greater than or equal to --interval")
    if args.required and args.pr is None:
        parser.error("--required can only be used with --pr")
    return args


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than 0")
    return parsed


def non_negative_int(value: str) -> int:
    parsed = int(value)
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be greater than or equal to 0")
    return parsed


def main() -> int:
    args = parse_args()
    repo_root = find_git_root(Path(args.repo))
    if repo_root is None:
        print("Error: not inside a Git repository.", file=sys.stderr)
        return 2

    runner = run_gh_command
    if not ensure_gh_available(repo_root, runner):
        return 2

    target = build_target(args, repo_root)
    fetch_observation = build_fetch_observation(args, repo_root, runner)
    try:
        result = wait_until_terminal(
            target=target,
            fetch_observation=fetch_observation,
            repo_root=repo_root,
            runner=runner,
            interval_seconds=args.interval,
            max_interval_seconds=args.max_interval,
            timeout_seconds=args.timeout,
            failure_log_lines=0 if args.no_failure_logs else args.failure_log_lines,
            emit_transition=None if args.quiet else emit_transition,
        )
        if args.evidence:
            write_evidence(args.evidence, result)
    except WaitError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(result_to_json(result), indent=2))
    else:
        render_text_result(result)

    if result.outcome == "success":
        return 0
    if result.outcome == "timeout":
        return 124
    return 1


def run_gh_command(args: Sequence[str], cwd: Path) -> GhResult:
    process = subprocess.run(["gh", *args], cwd=cwd, text=True, capture_output=True)
    return GhResult(process.returncode, process.stdout, process.stderr)


def find_git_root(start: Path) -> Path | None:
    if not start.exists():
        return None
    cwd = start.parent if start.is_file() else start
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=cwd,
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        return None
    return Path(result.stdout.strip())


def ensure_gh_available(repo_root: Path, runner: GhRunner) -> bool:
    if which("gh") is None:
        print("Error: gh is not installed or not on PATH.", file=sys.stderr)
        return False
    result = runner(["auth", "status"], repo_root)
    if result.returncode == 0:
        return True
    message = (result.stderr or result.stdout or "").strip()
    print(message or "Error: gh is not authenticated.", file=sys.stderr)
    return False


def build_target(args: argparse.Namespace, repo_root: Path) -> dict[str, Any]:
    target: dict[str, Any] = {"repoRoot": str(repo_root)}
    if args.run_id:
        target.update({"type": "RUN", "runId": args.run_id})
    else:
        target.update({"type": "PR", "pr": args.pr or "current", "required": args.required})
    return target


def build_fetch_observation(
    args: argparse.Namespace,
    repo_root: Path,
    runner: GhRunner,
) -> Callable[[], Observation]:
    if args.run_id:
        return lambda: fetch_run_observation(args.run_id, repo_root, runner)
    return lambda: fetch_pr_observation(args.pr, args.required, repo_root, runner)


def wait_until_terminal(
    *,
    target: dict[str, Any],
    fetch_observation: Callable[[], Observation],
    repo_root: Path,
    runner: GhRunner,
    interval_seconds: int,
    max_interval_seconds: int,
    timeout_seconds: int,
    failure_log_lines: int,
    emit_transition: Callable[[Transition], None] | None = None,
    monotonic: Callable[[], float] = time.monotonic,
    sleeper: Callable[[float], None] = time.sleep,
    now: Callable[[], str] | None = None,
) -> WaitResult:
    if now is None:
        now = utc_now
    started_at = now()
    started_monotonic = monotonic()
    deadline = None if timeout_seconds == 0 else started_monotonic + timeout_seconds
    current_interval = interval_seconds
    polls = 0
    previous_key: str | None = None
    previous_summary: str | None = None
    transitions: list[Transition] = []

    while True:
        latest = fetch_observation()
        polls += 1
        if latest.state_key != previous_key:
            transition = Transition(
                observedAt=now(),
                previousSummary=previous_summary,
                summary=latest.summary,
                stateKey=latest.state_key,
            )
            transitions.append(transition)
            if emit_transition:
                emit_transition(transition)
            previous_key = latest.state_key
            previous_summary = latest.summary
            current_interval = interval_seconds

        if latest.outcome != "pending":
            failure_logs = []
            if latest.outcome == "failure" and failure_log_lines > 0:
                failure_logs = fetch_failure_logs(
                    latest.failing_run_ids,
                    repo_root,
                    runner,
                    failure_log_lines,
                )
            return WaitResult(
                target=target,
                outcome=latest.outcome,
                polls=polls,
                startedAt=started_at,
                finishedAt=now(),
                transitions=transitions,
                final=latest.data,
                failureLogs=failure_logs,
            )

        if deadline is not None:
            remaining = deadline - monotonic()
            if remaining <= 0:
                return WaitResult(
                    target=target,
                    outcome="timeout",
                    polls=polls,
                    startedAt=started_at,
                    finishedAt=now(),
                    transitions=transitions,
                    final=latest.data,
                    failureLogs=[],
                )
            sleep_seconds = min(current_interval, remaining)
        else:
            sleep_seconds = current_interval

        sleeper(sleep_seconds)
        current_interval = min(max_interval_seconds, max(current_interval + 1, current_interval * 2))


def fetch_run_observation(run_id: str, repo_root: Path, runner: GhRunner) -> Observation:
    result = runner(["run", "view", run_id, "--json", ",".join(DEFAULT_FIELDS)], repo_root)
    if result.returncode != 0:
        raise WaitError(command_error("gh run view", result))
    data = parse_json_object(result.stdout, "gh run view")
    clean_data = clean_run_data(data, run_id)
    status = normalize(clean_data.get("status"))
    conclusion = normalize(clean_data.get("conclusion"))
    jobs = list(clean_data.get("jobs", []))
    state_key = stable_json(
        {
            "runId": run_id,
            "status": status,
            "conclusion": conclusion,
            "jobs": [
                {
                    "name": job.get("name"),
                    "status": normalize(job.get("status")),
                    "conclusion": normalize(job.get("conclusion")),
                }
                for job in jobs
            ],
        }
    )
    outcome = classify_run(status, conclusion)
    summary = summarize_run(run_id, clean_data)
    failing_run_ids = (run_id,) if outcome == "failure" else ()
    return Observation(
        outcome=outcome,
        state_key=state_key,
        summary=summary,
        data=clean_data,
        failing_run_ids=failing_run_ids,
    )


def fetch_pr_observation(
    pr_value: str | None,
    required_only: bool,
    repo_root: Path,
    runner: GhRunner,
) -> Observation:
    args = ["pr", "checks"]
    if pr_value:
        args.append(pr_value)
    args.extend(["--json", ",".join(CHECK_FIELDS)])
    if required_only:
        args.append("--required")
    result = runner(args, repo_root)
    if result.returncode != 0 and not result.stdout.strip():
        raise WaitError(command_error("gh pr checks", result))
    checks = parse_json_list(result.stdout, "gh pr checks")
    clean_checks = [clean_check(check) for check in checks]
    clean_checks.sort(key=lambda check: str(check.get("name", "")))
    state_key = stable_json(
        {
            "requiredOnly": required_only,
            "checks": [
                {
                    "name": check.get("name"),
                    "bucket": normalize(check.get("bucket")),
                    "state": normalize(check.get("state")),
                }
                for check in clean_checks
            ],
        }
    )
    outcome = classify_checks(clean_checks)
    summary = summarize_checks(clean_checks, required_only)
    failing_run_ids = tuple(unique_run_ids(clean_checks)) if outcome == "failure" else ()
    return Observation(
        outcome=outcome,
        state_key=state_key,
        summary=summary,
        data={"requiredOnly": required_only, "checks": clean_checks},
        failing_run_ids=failing_run_ids,
    )


def clean_run_data(data: dict[str, Any], run_id: str) -> dict[str, Any]:
    return {
        "runId": run_id,
        "attempt": data.get("attempt"),
        "conclusion": data.get("conclusion"),
        "createdAt": data.get("createdAt"),
        "databaseId": data.get("databaseId"),
        "displayTitle": data.get("displayTitle"),
        "event": data.get("event"),
        "headBranch": data.get("headBranch"),
        "headSha": data.get("headSha"),
        "jobs": [clean_job(job) for job in data.get("jobs", []) if isinstance(job, dict)],
        "name": data.get("name"),
        "startedAt": data.get("startedAt"),
        "status": data.get("status"),
        "updatedAt": data.get("updatedAt"),
        "url": data.get("url"),
        "workflowName": data.get("workflowName"),
    }


def clean_job(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "completedAt": job.get("completedAt"),
        "conclusion": job.get("conclusion"),
        "databaseId": job.get("databaseId"),
        "name": job.get("name"),
        "startedAt": job.get("startedAt"),
        "status": job.get("status"),
        "url": job.get("url"),
    }


def clean_check(check: dict[str, Any]) -> dict[str, Any]:
    return {
        "bucket": check.get("bucket"),
        "completedAt": check.get("completedAt"),
        "event": check.get("event"),
        "link": check.get("link"),
        "name": check.get("name"),
        "startedAt": check.get("startedAt"),
        "state": check.get("state"),
        "workflow": check.get("workflow"),
    }


def classify_run(status: str, conclusion: str) -> str:
    if status != TERMINAL_RUN_STATUS:
        return "pending"
    if conclusion in FAILURE_CONCLUSIONS:
        return "failure"
    if not conclusion:
        return "failure"
    return "success"


def classify_checks(checks: Sequence[dict[str, Any]]) -> str:
    if any(check_is_failure(check) for check in checks):
        return "failure"
    if any(check_is_pending(check) for check in checks):
        return "pending"
    return "success"


def check_is_pending(check: dict[str, Any]) -> bool:
    bucket = normalize(check.get("bucket"))
    state = normalize(check.get("state"))
    return bucket in PENDING_CHECK_BUCKETS or state in PENDING_STATES


def check_is_failure(check: dict[str, Any]) -> bool:
    bucket = normalize(check.get("bucket"))
    state = normalize(check.get("state"))
    return bucket in FAILURE_CHECK_BUCKETS or state in FAILURE_CONCLUSIONS


def summarize_run(run_id: str, data: dict[str, Any]) -> str:
    workflow = data.get("workflowName") or data.get("name") or f"run {run_id}"
    status = normalize(data.get("status")) or "unknown"
    conclusion = normalize(data.get("conclusion"))
    jobs = data.get("jobs", [])
    job_summary = summarize_job_counts(jobs) if jobs else "no jobs reported"
    state = f"{status}/{conclusion}" if conclusion else status
    return f"run {run_id} {workflow}: {state}; {job_summary}"


def summarize_job_counts(jobs: Sequence[dict[str, Any]]) -> str:
    counts: Counter[str] = Counter()
    for job in jobs:
        status = normalize(job.get("status"))
        conclusion = normalize(job.get("conclusion"))
        if status != TERMINAL_RUN_STATUS:
            counts["pending"] += 1
        elif conclusion in FAILURE_CONCLUSIONS:
            counts["failed"] += 1
        else:
            counts["passed"] += 1
    return ", ".join(f"{count} {name}" for name, count in sorted(counts.items())) or "no jobs reported"


def summarize_checks(checks: Sequence[dict[str, Any]], required_only: bool) -> str:
    counts: Counter[str] = Counter()
    for check in checks:
        bucket = normalize(check.get("bucket"))
        if not bucket:
            bucket = "unknown"
        counts[bucket] += 1
    scope = "required checks" if required_only else "checks"
    if not checks:
        return f"{scope}: no checks reported"
    count_summary = ", ".join(f"{count} {name}" for name, count in sorted(counts.items()))
    return f"{scope}: {count_summary}"


def fetch_failure_logs(
    run_ids: Sequence[str],
    repo_root: Path,
    runner: GhRunner,
    max_lines: int,
) -> list[dict[str, Any]]:
    logs: list[dict[str, Any]] = []
    for run_id in run_ids:
        result = runner(["run", "view", run_id, "--log-failed"], repo_root)
        if result.returncode != 0:
            logs.append(
                {
                    "runId": run_id,
                    "status": "unavailable",
                    "error": (result.stderr or result.stdout or "").strip(),
                }
            )
            continue
        logs.append(
            {
                "runId": run_id,
                "status": "ok",
                "tail": tail_lines(result.stdout, max_lines),
            }
        )
    return logs


def unique_run_ids(checks: Sequence[dict[str, Any]]) -> list[str]:
    seen: set[str] = set()
    run_ids: list[str] = []
    for check in checks:
        if not check_is_failure(check):
            continue
        run_id = extract_run_id(str(check.get("link") or ""))
        if run_id and run_id not in seen:
            seen.add(run_id)
            run_ids.append(run_id)
    return run_ids


def extract_run_id(url: str) -> str | None:
    match = re.search(r"/actions/runs/(\d+)", url)
    if match:
        return match.group(1)
    match = re.search(r"/runs/(\d+)", url)
    if match:
        return match.group(1)
    return None


def parse_json_object(raw: str, source: str) -> dict[str, Any]:
    try:
        data = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        raise WaitError(f"unable to parse {source} JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise WaitError(f"unexpected {source} JSON shape")
    return data


def parse_json_list(raw: str, source: str) -> list[dict[str, Any]]:
    try:
        data = json.loads(raw or "[]")
    except json.JSONDecodeError as exc:
        raise WaitError(f"unable to parse {source} JSON: {exc}") from exc
    if not isinstance(data, list):
        raise WaitError(f"unexpected {source} JSON shape")
    if not all(isinstance(item, dict) for item in data):
        raise WaitError(f"unexpected {source} item shape")
    return data


def command_error(command: str, result: GhResult) -> str:
    message = (result.stderr or result.stdout or "").strip()
    return message or f"{command} failed with exit code {result.returncode}"


def write_evidence(path: Path, result: WaitResult) -> None:
    if path.parent and not path.parent.exists():
        raise WaitError(f"evidence directory does not exist: {path.parent}")
    path.write_text(json.dumps(result_to_json(result), indent=2) + "\n", encoding="utf-8")


def result_to_json(result: WaitResult) -> dict[str, Any]:
    return asdict(result)


def render_text_result(result: WaitResult) -> None:
    print(f"outcome: {result.outcome}")
    print(f"polls: {result.polls}")
    print(f"startedAt: {result.startedAt}")
    print(f"finishedAt: {result.finishedAt}")
    if result.transitions:
        print("transitions:")
        for transition in result.transitions:
            print(f"- {transition.observedAt}: {transition.summary}")
    if result.failureLogs:
        print("failure logs:")
        for log in result.failureLogs:
            print(f"- run {log.get('runId')}: {log.get('status')}")
            if log.get("error"):
                print(indent(str(log["error"]), "  "))
            if log.get("tail"):
                print(indent(str(log["tail"]), "  "))


def emit_transition(transition: Transition) -> None:
    print(f"{transition.observedAt}: {transition.summary}", file=sys.stderr)


def tail_lines(text: str, max_lines: int) -> str:
    if max_lines <= 0:
        return ""
    lines = text.splitlines()
    return "\n".join(lines[-max_lines:])


def indent(text: str, prefix: str) -> str:
    return "\n".join(f"{prefix}{line}" for line in text.splitlines())


def stable_json(data: dict[str, Any]) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def normalize(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
