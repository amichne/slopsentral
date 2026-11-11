from __future__ import annotations

import re
from dataclasses import replace
import subprocess
from pathlib import Path
from typing import Sequence, cast

from ci_actions_pr_summary import parse_pr_checks
from ci_actions_run_parser import parse_run_view
from ci_actions_types import (
    Commit,
    CommandResult,
    CommandRunner,
    GH_PREFIX,
    ObserverError,
    Snapshot,
    Target,
    TargetKind,
    TransientObserverError,
)
from ci_actions_scalars import parse_json


def run_command(args: Sequence[str], cwd: Path) -> CommandResult:
    try:
        process = subprocess.run(args, cwd=cwd, text=True, capture_output=True, timeout=30)
    except subprocess.TimeoutExpired:
        return CommandResult(124, "", f"{args[0]} timed out after 30 seconds")
    return CommandResult(process.returncode, process.stdout, process.stderr)


def fetch_snapshot(
    target: Target,
    repo_root: Path,
    runner: CommandRunner = run_command,
) -> Snapshot:
    if target.kind == TargetKind.RUN:
        result = runner(
            [
                *GH_PREFIX,
                "run",
                "view",
                target.value,
                "--json",
                "status,conclusion,jobs,workflowName,headSha",
            ],
            repo_root,
        )
        require_success(result, "gh run view")
        snapshot = parse_run_view(result.stdout, target.value)
        head = snapshot.target.head
        if head is None:
            raise ObserverError("run view did not establish a head SHA")
        require_head(target.head, head, "run")
        return snapshot
    number = pr_number(target.value)
    head = fetch_pr_head(number, repo_root, runner)
    require_head(target.head, head)
    command = [*GH_PREFIX, "pr", "checks", number, "--json", "name,state,bucket"]
    if target.required:
        command.append("--required")
    result = runner(command, repo_root)
    if no_checks(result, required=target.required):
        snapshot = parse_pr_checks("[]", number, required=target.required)
    else:
        if result.returncode != 0 and not (result.returncode in {1, 8} and result.stdout.strip()):
            require_success(result, "gh pr checks")
        snapshot = parse_pr_checks(result.stdout, number, required=target.required)
    require_head(head, fetch_pr_head(number, repo_root, runner))
    return replace(snapshot, target=replace(snapshot.target, head=head))


def fetch_pr_head(number: str, repo_root: Path, runner: CommandRunner) -> Commit:
    result = runner([*GH_PREFIX, "pr", "view", number, "--json", "headRefOid"], repo_root)
    require_success(result, "gh pr view")
    payload = parse_json(result.stdout, "gh pr view")
    if not isinstance(payload, dict):
        raise ObserverError("gh pr view JSON must be an object")
    head = cast(dict[str, object], payload).get("headRefOid")
    if not isinstance(head, str):
        raise ObserverError("gh pr view output needs a string headRefOid")
    return Commit(head)


def require_head(expected: Commit | None, actual: Commit, kind: str = "PR") -> None:
    if expected is not None and expected != actual:
        raise ObserverError(f"{kind} head changed: expected {expected.value}, observed {actual.value}")


def pr_number(value: str) -> str:
    if value.isdigit() and int(value) > 0:
        return value
    match = re.fullmatch(r"https://github\.com/[^/]+/[^/]+/pull/(\d+)/?", value)
    if match and int(match.group(1)) > 0:
        return match.group(1)
    raise ObserverError("PR target must be a positive PR number or GitHub PR URL")


def resolve_repository_slug(repo_root: Path, runner: CommandRunner = run_command) -> str:
    result = runner(["git", "remote", "get-url", "origin"], repo_root)
    require_success(result, "git remote get-url origin")
    remote = result.stdout.strip().removesuffix(".git")
    patterns = (
        r"^git@[^:]+:(?P<slug>[^/]+/[^/]+)$",
        r"^ssh://git@[^/]+/(?P<slug>[^/]+/[^/]+)$",
        r"^https?://[^/]+/(?P<slug>[^/]+/[^/]+)$",
    )
    for pattern in patterns:
        match = re.fullmatch(pattern, remote)
        if match:
            return match.group("slug")
    raise ObserverError("unable to resolve GitHub repository from origin remote")


def runner_capacity(
    labels: Sequence[str], repo_root: Path, runner: CommandRunner
) -> dict[str, object]:
    repository = resolve_repository_slug(repo_root, runner)
    command = [
        *GH_PREFIX, "api", "--paginate", "--slurp",
        f"repos/{repository}/actions/runners?per_page=100",
    ]
    result = runner(command, repo_root)
    require_success(result, "gh api actions runners")
    pages = parse_json(result.stdout, "gh api actions runners")
    if not isinstance(pages, list) or not pages:
        raise ObserverError("runner list must contain at least one response page")
    online = idle = offline = 0
    for page in pages:
        if not isinstance(page, dict) or not isinstance(page.get("runners"), list):
            raise ObserverError("runner page needs a runner list")
        for record in page["runners"]:
            if not isinstance(record, dict) or not isinstance(record.get("labels"), list):
                raise ObserverError("runner needs a label list")
            entries = record["labels"]
            if not all(isinstance(label, dict) and isinstance(label.get("name"), str)
                       for label in entries):
                raise ObserverError("runner labels need names")
            names = {label["name"].casefold() for label in entries}
            if not all(label.casefold() in names for label in labels):
                continue
            status, busy = record.get("status"), record.get("busy")
            if status not in ("online", "offline") or not isinstance(busy, bool):
                raise ObserverError("matching runner needs an online state and busy flag")
            online += status == "online"
            idle += status == "online" and not busy
            offline += status == "offline"
    state = "idle" if idle else "busy" if online else "unavailable"
    return {
        "repository": repository, "labels": list(labels), "state": state,
        "idle": idle, "busy": online - idle, "offline": offline,
    }


def no_checks(result: CommandResult, *, required: bool) -> bool:
    qualifier = "required " if required else ""
    return (
        result.returncode == 1
        and not result.stdout.strip()
        and re.fullmatch(
            rf"no {qualifier}checks reported on the '[^']+' branch",
            result.stderr.strip(),
        )
        is not None
    )


def require_success(result: CommandResult, command: str) -> None:
    if result.returncode == 0:
        return
    message = (result.stderr or result.stdout).strip()
    detail = message or f"{command} failed with exit code {result.returncode}"
    if is_transient_failure(detail):
        raise TransientObserverError(detail)
    raise ObserverError(detail)


def is_transient_failure(message: str) -> bool:
    lowered = message.lower()
    markers = (
        "temporary",
        "temporarily",
        "timed out",
        "timeout",
        "connection reset",
        "connection refused",
        "network error",
        "bad gateway",
        "service unavailable",
        "gateway timeout",
        "http 502",
        "http 503",
        "http 504",
        "status 502",
        "status 503",
        "status 504",
    )
    return any(marker in lowered for marker in markers)
