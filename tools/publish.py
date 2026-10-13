#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = []
# [tool.uv]
# no-build = true
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""Publish validated provider trees with source provenance and ordinary Git pushes."""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import assert_never


class Destination(StrEnum):
    MAIN = "main"
    CODEX = "harness/codex"
    COPILOT = "harness/github-copilot"


class FailureCode(StrEnum):
    INPUT = "invalid-input"
    PROJECTION = "invalid-projection"
    PROCESS = "git-failed"
    PROVENANCE = "provenance-rejected"
    FILESYSTEM = "filesystem-failed"
    CLEANUP = "cleanup-failed"


@dataclass(frozen=True, slots=True)
class Failure:
    code: FailureCode
    message: str


@dataclass(frozen=True, slots=True)
class SourceCommit:
    sha: str


@dataclass(frozen=True, slots=True)
class Publication:
    projection: Path
    target: Destination
    source_branch: str
    source: SourceCommit
    remote: str

    def roots(self) -> tuple[str, ...]:
        match self.target:
            case Destination.MAIN:
                return (".agents/plugins", ".github/plugin")
            case Destination.CODEX:
                return (".agents/plugins",)
            case Destination.COPILOT:
                return (".github/plugin",)
        assert_never(self.target)


@dataclass(frozen=True, slots=True)
class Output:
    text: str


class Freshness(StrEnum):
    CURRENT = "current"
    STALE = "stale"


def parse(arguments: list[str]) -> Publication | Failure:
    match arguments:
        case ["main", projection, sha]:
            target, source_branch, remote = Destination.MAIN, "main", "origin"
        case ["harness", projection, target_name, source_branch, sha, *optional] if (
            len(optional) <= 1
        ):
            if target_name not in {Destination.CODEX, Destination.COPILOT}:
                return Failure(FailureCode.INPUT, "unsupported target branch")
            target = Destination(target_name)
            remote = optional[0] if optional else "origin"
        case _:
            return Failure(
                FailureCode.INPUT,
                "usage: publish.py main PROJECTION SHA | harness PROJECTION TARGET SOURCE SHA [REMOTE]",
            )
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        return Failure(FailureCode.INPUT, "source SHA must be 40 lowercase hexadecimal characters")
    if not re.fullmatch(r"[A-Za-z0-9._-]+", remote) or remote.startswith("-"):
        return Failure(FailureCode.INPUT, "invalid remote name")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", source_branch):
        return Failure(FailureCode.INPUT, "invalid source branch")
    return Publication(
        Path(projection).absolute(), target, source_branch, SourceCommit(sha), remote
    )


def inspect(publication: Publication) -> Publication | Failure:
    directory = publication.projection
    roots = publication.roots()
    if directory.is_symlink() or not directory.is_dir():
        return Failure(FailureCode.PROJECTION, "projection must be a regular directory")
    if {p.name for p in directory.iterdir()} != {root.split("/")[0] for root in roots}:
        return Failure(FailureCode.PROJECTION, f"projection must contain only {', '.join(roots)}")
    for root in roots:
        checked = inspect_provider(directory, root)
        if isinstance(checked, Failure):
            return checked
    if any(
        p.is_symlink() or p.name == ".git" or not (p.is_file() or p.is_dir())
        for p in directory.rglob("*")
    ):
        return Failure(
            FailureCode.PROJECTION,
            "projection contains symlinks, Git metadata, or nonregular files",
        )
    return publication


def inspect_provider(directory: Path, root: str) -> Output | Failure:
    top = directory / root.split("/")[0]
    if top.is_symlink() or not top.is_dir():
        return Failure(FailureCode.PROJECTION, "invalid provider directory")
    if {p.name for p in top.iterdir()} != {root.split("/")[1]}:
        return Failure(FailureCode.PROJECTION, f"projection must contain only {root}")
    if not (directory / root / "marketplace.json").is_file():
        return Failure(FailureCode.PROJECTION, f"missing {root}/marketplace.json")
    return Output(root)


def git(repo: Path, *arguments: str) -> Output | Failure:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo), *arguments], capture_output=True, text=True, check=False
        )
    except OSError:
        return Failure(FailureCode.PROCESS, "Git unavailable")
    if result.returncode:
        return Failure(
            FailureCode.PROCESS, f"Git {arguments[0]} failed with exit {result.returncode}"
        )
    return Output(result.stdout.strip())


def freshness(repo: Path, publication: Publication) -> Freshness | Failure:
    ref = f"refs/remotes/{publication.remote}/{publication.source_branch}"
    fetched = git(
        repo,
        "fetch",
        "--no-tags",
        publication.remote,
        f"+refs/heads/{publication.source_branch}:{ref}",
    )
    if isinstance(fetched, Failure):
        return fetched
    current = git(repo, "rev-parse", ref)
    if isinstance(current, Failure):
        return current
    if current.text != publication.source.sha:
        print(
            f"::notice::{publication.source_branch} advanced; skipping stale marketplace publication."
        )
        return Freshness.STALE
    return Freshness.CURRENT


def provenance(repo: Path, publication: Publication, target_ref: str) -> Output | Failure:
    refreshed = freshness(repo, publication)
    if isinstance(refreshed, Failure):
        return refreshed
    if refreshed is Freshness.STALE:
        return Failure(FailureCode.PROVENANCE, "source advanced during provenance check")
    trailer = git(repo, "log", "-1", "--format=%(trailers:key=Source-Commit,valueonly)", target_ref)
    if isinstance(trailer, Failure):
        return trailer
    if not re.fullmatch(r"[0-9a-f]{40}", trailer.text):
        return Failure(FailureCode.PROVENANCE, "target has no valid Source-Commit provenance")
    ancestry = git(repo, "merge-base", "--is-ancestor", trailer.text, publication.source.sha)
    if isinstance(ancestry, Failure):
        return Failure(
            FailureCode.PROVENANCE, f"refusing to move {publication.target.value} backward"
        )
    return Output(target_ref)


def prepare(repo: Path, worktree: Path, publication: Publication) -> Output | Failure:
    if publication.target is Destination.MAIN:
        return git(repo, "worktree", "add", "--detach", str(worktree), publication.source.sha)
    target_ref = f"refs/remotes/{publication.remote}/{publication.target.value}"
    listing = git(
        repo, "ls-remote", "--heads", publication.remote, f"refs/heads/{publication.target.value}"
    )
    if isinstance(listing, Failure):
        return listing
    if listing.text:
        fetched = git(
            repo,
            "fetch",
            "--no-tags",
            publication.remote,
            f"+refs/heads/{publication.target.value}:{target_ref}",
        )
        if isinstance(fetched, Failure):
            return fetched
        verified = provenance(repo, publication, target_ref)
        return (
            verified
            if isinstance(verified, Failure)
            else git(repo, "worktree", "add", "--detach", str(worktree), verified.text)
        )
    created = git(repo, "worktree", "add", "--detach", str(worktree), publication.source.sha)
    if isinstance(created, Failure):
        return created
    return git(worktree, "switch", "--orphan", publication.target.value)


def copy_payload(worktree: Path, publication: Publication) -> Output | Failure:
    if publication.target is not Destination.MAIN:
        removed = git(worktree, "rm", "-rf", "--ignore-unmatch", "--", ".")
        if isinstance(removed, Failure):
            return removed
    for root in publication.roots():
        destination = worktree / root
        if destination.is_symlink() or destination.parent.is_symlink():
            return Failure(FailureCode.PROJECTION, "unsafe destination")
        if destination.exists():
            shutil.rmtree(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)
        _ = shutil.copytree(publication.projection / root, destination)
        staged = git(worktree, "add", "-f", "-A", "--", root)
        if isinstance(staged, Failure):
            return staged
    return git(worktree, "diff", "--cached", "--check")


def finish(repo: Path, worktree: Path, publication: Publication) -> Output | Failure:
    copied = copy_payload(worktree, publication)
    if isinstance(copied, Failure):
        return copied
    diff = git(worktree, "diff", "--cached", "--name-only")
    if isinstance(diff, Failure):
        return diff
    if not diff.text:
        return Output(f"{publication.target.value} is already current.")
    committed = git(
        worktree,
        "-c",
        "user.name=github-actions[bot]",
        "-c",
        "user.email=github-actions[bot]@users.noreply.github.com",
        "commit",
        "-m",
        f"chore: publish {publication.target.value}",
        "-m",
        f"Source-Commit: {publication.source.sha}",
    )
    if isinstance(committed, Failure):
        return committed
    return push_current(repo, worktree, publication)


def push_current(repo: Path, worktree: Path, publication: Publication) -> Output | Failure:
    current = freshness(repo, publication)
    if isinstance(current, Failure):
        return current
    if current is Freshness.STALE:
        return Output("stale publication skipped")
    return git(worktree, "push", publication.remote, f"HEAD:refs/heads/{publication.target.value}")


def publish(publication: Publication) -> Output | Failure:
    repo = Path.cwd()
    current = freshness(repo, publication)
    if isinstance(current, Failure):
        return current
    if current is Freshness.STALE:
        return Output("stale publication skipped")
    with tempfile.TemporaryDirectory(prefix="slopsentral-publish-") as temporary:
        worktree = Path(temporary) / "payload"
        outcome: Output | Failure
        try:
            prepared = prepare(repo, worktree, publication)
            outcome = (
                prepared if isinstance(prepared, Failure) else finish(repo, worktree, publication)
            )
        finally:
            cleanup = (
                git(repo, "worktree", "remove", "--force", str(worktree))
                if worktree.exists()
                else Output("")
            )
        if isinstance(cleanup, Failure):
            return Failure(
                FailureCode.CLEANUP,
                "worktree cleanup failed; publication outcome requires inspection",
            )
        return outcome


def main() -> int:
    parsed = parse(sys.argv[1:])
    try:
        validated = parsed if isinstance(parsed, Failure) else inspect(parsed)
        result = validated if isinstance(validated, Failure) else publish(validated)
    except OSError:
        result = Failure(
            FailureCode.FILESYSTEM, "filesystem operation failed; inspect publication state"
        )
    match result:
        case Failure(code, message):
            print(f"publish: stage={code.value}: {message}", file=sys.stderr)
            return 1
        case Output(text):
            print(text)
            return 0
    assert_never(result)


if __name__ == "__main__":
    raise SystemExit(main())
