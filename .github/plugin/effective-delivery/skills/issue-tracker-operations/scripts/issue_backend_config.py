from __future__ import annotations

from dataclasses import dataclass
import os
import re
from typing import Mapping

from issue_backend_types import Backend, IssueBackendError


BACKEND_ENVIRONMENT_VARIABLE = "EFFECTIVE_DELIVERY_ISSUE_BACKEND"
GITHUB_REPOSITORY_ENVIRONMENT_VARIABLE = "EFFECTIVE_DELIVERY_GITHUB_REPOSITORY"
GITHUB_REPOSITORY_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


@dataclass(frozen=True)
class GitHubRepository:
    owner: str
    name: str

    @classmethod
    def parse(cls, raw: str) -> "GitHubRepository":
        value = raw.strip()
        if not GITHUB_REPOSITORY_PATTERN.fullmatch(value):
            raise IssueBackendError(
                "GITHUB_REPOSITORY_INVALID",
                f"{GITHUB_REPOSITORY_ENVIRONMENT_VARIABLE} must use owner/repository syntax.",
                "SET_GITHUB_REPOSITORY",
            )
        owner, name = value.split("/", maxsplit=1)
        return cls(owner=owner, name=name)

    def __str__(self) -> str:
        return f"{self.owner}/{self.name}"


def resolve_backend(
    explicit: str | None,
    environment: Mapping[str, str] = os.environ,
) -> Backend:
    raw = explicit if explicit is not None else environment.get(BACKEND_ENVIRONMENT_VARIABLE)
    if raw is None or not raw.strip():
        raise IssueBackendError(
            "BACKEND_REQUIRED",
            f"Set --backend or {BACKEND_ENVIRONMENT_VARIABLE} to github or jira.",
            "SELECT_SUPPORTED_BACKEND",
        )
    normalized = raw.strip().upper()
    try:
        return Backend(normalized)
    except ValueError as error:
        raise IssueBackendError(
            "BACKEND_UNSUPPORTED",
            f"Set --backend or {BACKEND_ENVIRONMENT_VARIABLE} to github or jira.",
            "SELECT_SUPPORTED_BACKEND",
        ) from error


def resolve_github_repository(
    environment: Mapping[str, str] = os.environ,
) -> GitHubRepository:
    raw = environment.get(GITHUB_REPOSITORY_ENVIRONMENT_VARIABLE)
    if raw is None:
        raise IssueBackendError(
            "GITHUB_REPOSITORY_REQUIRED",
            f"Set {GITHUB_REPOSITORY_ENVIRONMENT_VARIABLE} to owner/repository.",
            "SET_GITHUB_REPOSITORY",
        )
    return GitHubRepository.parse(raw)
