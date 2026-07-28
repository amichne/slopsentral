from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from typing import Sequence

from ci_actions_pr_required import parse_required_pr_checks
from ci_actions_pr_summary import parse_pr_checks
from ci_actions_run_parser import parse_run_view
from ci_actions_types import (
    AxiResult,
    AxiRunner,
    GH_AXI_PREFIX,
    ObserverError,
    Snapshot,
    Target,
    TargetKind,
    TransientObserverError,
)


def run_gh_axi(args: Sequence[str], cwd: Path) -> AxiResult:
    process = subprocess.run(args, cwd=cwd, text=True, capture_output=True)
    return AxiResult(process.returncode, process.stdout, process.stderr)


def fetch_snapshot(
    target: Target,
    repo_root: Path,
    runner: AxiRunner = run_gh_axi,
) -> Snapshot:
    if target.kind == TargetKind.RUN:
        result = runner([*GH_AXI_PREFIX, "run", "view", target.value], repo_root)
        require_success(result, "gh-axi run view")
        return parse_run_view(result.stdout, target.value)
    number = pr_number(target.value)
    if target.required:
        repository = resolve_repository_slug(repo_root, runner)
        result = runner(required_checks_command(repository, number), repo_root)
        require_success(result, "gh-axi required PR checks API")
        return parse_required_pr_checks(result.stdout, number)
    result = runner([*GH_AXI_PREFIX, "pr", "checks", number], repo_root)
    require_success(result, "gh-axi pr checks")
    return parse_pr_checks(result.stdout, number)


def pr_number(value: str) -> str:
    if value.isdigit() and int(value) > 0:
        return value
    match = re.fullmatch(r"https://github\.com/[^/]+/[^/]+/pull/(\d+)/?", value)
    if match and int(match.group(1)) > 0:
        return match.group(1)
    raise ObserverError("PR target must be a positive PR number or GitHub PR URL")


def resolve_repository_slug(repo_root: Path, runner: AxiRunner = run_gh_axi) -> str:
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


def required_checks_command(repository: str, pr: str) -> list[str]:
    owner, name = repository.split("/", maxsplit=1)
    query = (
        "query { repository(owner:"
        f"{json.dumps(owner)}, name:{json.dumps(name)}) {{ "
        f"pullRequest(number:{pr}) {{ commits(last:1) {{ nodes {{ commit {{ "
        "statusCheckRollup { contexts(first:100) { nodes { __typename "
        f"... on CheckRun {{ name conclusion isRequired(pullRequestNumber:{pr}) }} "
        f"... on StatusContext {{ context state isRequired(pullRequestNumber:{pr}) }} "
        "} } } } } } } } }"
    )
    return [*GH_AXI_PREFIX, "api", "POST", "graphql", "--field", f"query={query}"]


def require_success(result: AxiResult, command: str) -> None:
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
