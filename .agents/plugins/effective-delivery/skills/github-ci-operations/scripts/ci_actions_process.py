from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Sequence

from ci_actions_pr_summary import parse_pr_checks
from ci_actions_run_parser import parse_run_view
from ci_actions_types import (
    CommandResult,
    CommandRunner,
    GH_PREFIX,
    ObserverError,
    Snapshot,
    Target,
    TargetKind,
    TransientObserverError,
)


def run_command(args: Sequence[str], cwd: Path) -> CommandResult:
    process = subprocess.run(args, cwd=cwd, text=True, capture_output=True)
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
                "status,conclusion,jobs,workflowName",
            ],
            repo_root,
        )
        require_success(result, "gh run view")
        return parse_run_view(result.stdout, target.value)
    number = pr_number(target.value)
    command = [*GH_PREFIX, "pr", "checks", number, "--json", "name,state,bucket"]
    if target.required:
        command.append("--required")
    result = runner(command, repo_root)
    if no_checks(result, required=target.required):
        return parse_pr_checks("[]", number, required=target.required)
    if result.returncode != 0 and not (
        result.returncode in {1, 8} and result.stdout.strip()
    ):
        require_success(result, "gh pr checks")
    return parse_pr_checks(result.stdout, number, required=target.required)


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
        "status 502",
        "status 503",
        "status 504",
    )
    return any(marker in lowered for marker in markers)
