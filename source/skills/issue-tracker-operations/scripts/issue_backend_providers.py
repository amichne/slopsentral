from __future__ import annotations

from dataclasses import dataclass
import json
import os
import subprocess
from typing import Mapping, Protocol, Sequence, cast

from issue_backend_config import GitHubRepository
from issue_backend_types import (
    Backend,
    CommandEvidence,
    DependencyEdge,
    DependencyMap,
    IssueBackendError,
    IssueIdentity,
    ProviderObservation,
)


GITHUB_API_VERSION = "2026-03-10"


JsonValue = dict[str, object] | list[object]


@dataclass(frozen=True)
class CommandOutput:
    stdout: str
    evidence: CommandEvidence


class CommandRunner:
    def __init__(self, environment: Mapping[str, str] = os.environ) -> None:
        self._environment = dict(environment)

    def run(self, executable: str, arguments: Sequence[str]) -> CommandOutput:
        command = [executable, *arguments]
        try:
            completed = subprocess.run(
                command,
                env=self._environment,
                text=True,
                capture_output=True,
                check=False,
            )
        except FileNotFoundError as error:
            raise IssueBackendError(
                "PROVIDER_CLI_UNAVAILABLE",
                f"The selected backend requires the {executable} executable on PATH.",
                "INSTALL_OR_CONFIGURE_PROVIDER_CLI",
            ) from error

        evidence = CommandEvidence(
            executable=executable,
            arguments=tuple(arguments),
            exit_code=completed.returncode,
        )
        if completed.returncode != 0:
            raise IssueBackendError(
                "PROVIDER_COMMAND_FAILED",
                f"The {executable} provider command exited with status {completed.returncode}.",
                "CHECK_PROVIDER_AUTHENTICATION_AND_TARGET",
                evidence=(evidence,),
            )
        return CommandOutput(stdout=completed.stdout, evidence=evidence)


class IssueProvider(Protocol):
    backend: Backend

    def view(self, identifier: str) -> ProviderObservation[IssueIdentity]: ...

    def dependency_map(self, identifier: str) -> ProviderObservation[DependencyMap]: ...


def _parse_json(output: CommandOutput) -> JsonValue:
    try:
        value = json.loads(output.stdout)
    except json.JSONDecodeError as error:
        raise IssueBackendError(
            "PROVIDER_OUTPUT_INVALID",
            "The provider command did not return valid JSON.",
            "UPDATE_OR_RECONFIGURE_PROVIDER_CLI",
            evidence=(output.evidence,),
        ) from error
    if not isinstance(value, (dict, list)):
        raise IssueBackendError(
            "PROVIDER_OUTPUT_INVALID",
            "The provider command returned an unsupported JSON root.",
            "UPDATE_OR_RECONFIGURE_PROVIDER_CLI",
            evidence=(output.evidence,),
        )
    return cast(JsonValue, value)


def _attach_evidence(
    error: IssueBackendError,
    evidence: tuple[CommandEvidence, ...],
) -> IssueBackendError:
    if error.evidence:
        return error
    return IssueBackendError(
        error.failure_id,
        error.message,
        error.recovery,
        evidence=evidence,
    )


def _mapping(value: object, context: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise IssueBackendError(
            "PROVIDER_OUTPUT_INVALID",
            f"The provider output omitted a valid {context} object.",
            "UPDATE_OR_RECONFIGURE_PROVIDER_CLI",
        )
    return cast(dict[str, object], value)


def _optional_text(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, (str, int)):
        return str(value)
    return None


def _status_name(value: object) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return _optional_text(value.get("name"))
    return None


def _github_issue(value: object) -> IssueIdentity:
    issue = _mapping(value, "issue")
    identifier = _optional_text(issue.get("number")) or _optional_text(issue.get("id"))
    if identifier is None:
        raise IssueBackendError(
            "PROVIDER_OUTPUT_INVALID",
            "The gh result omitted the GitHub issue number.",
            "UPDATE_OR_RECONFIGURE_PROVIDER_CLI",
        )
    return IssueIdentity(
        identifier=identifier,
        title=_optional_text(issue.get("title")),
        state=_status_name(issue.get("state")),
        url=_optional_text(issue.get("url")) or _optional_text(issue.get("html_url")),
    )


def _flatten_issue_pages(value: object) -> list[object]:
    if isinstance(value, list):
        flattened: list[object] = []
        for item in value:
            if isinstance(item, list):
                flattened.extend(_flatten_issue_pages(item))
            else:
                flattened.append(item)
        return flattened
    raise IssueBackendError(
        "PROVIDER_OUTPUT_INVALID",
        "The provider dependency result must be a JSON array.",
        "UPDATE_OR_RECONFIGURE_PROVIDER_CLI",
    )


class GitHubProvider:
    backend = Backend.GITHUB

    def __init__(self, runner: CommandRunner, repository: GitHubRepository) -> None:
        self._runner = runner
        self._repository = repository

    def view(self, identifier: str) -> ProviderObservation[IssueIdentity]:
        arguments = [
            "issue",
            "view",
            identifier,
            "--repo",
            str(self._repository),
            "--json",
            "number,title,state,url",
        ]
        output = self._runner.run("gh", arguments)
        try:
            issue = _github_issue(_parse_json(output))
        except IssueBackendError as error:
            raise _attach_evidence(error, (output.evidence,)) from error
        return ProviderObservation(value=issue, evidence=(output.evidence,))

    def _dependency_direction(self, identifier: str, direction: str) -> CommandOutput:
        endpoint = (
            f"/repos/{self._repository.owner}/{self._repository.name}/issues/{identifier}"
            f"/dependencies/{direction}?per_page=100"
        )
        return self._runner.run(
            "gh",
            [
                "api",
                "--paginate",
                "--slurp",
                "-H",
                f"X-GitHub-Api-Version: {GITHUB_API_VERSION}",
                endpoint,
            ],
        )

    def dependency_map(self, identifier: str) -> ProviderObservation[DependencyMap]:
        blocked_by_output = self._dependency_direction(identifier, "blocked_by")
        blocking_output = self._dependency_direction(identifier, "blocking")
        evidence = (blocked_by_output.evidence, blocking_output.evidence)
        try:
            blocked_by = _flatten_issue_pages(_parse_json(blocked_by_output))
            blocking = _flatten_issue_pages(_parse_json(blocking_output))
            root = IssueIdentity(identifier=identifier, title=None)
            edges = [DependencyEdge(source=_github_issue(item), target=root) for item in blocked_by]
            edges.extend(DependencyEdge(source=root, target=_github_issue(item)) for item in blocking)
        except IssueBackendError as error:
            raise _attach_evidence(error, evidence) from error
        return ProviderObservation(
            value=DependencyMap(root=identifier, edges=tuple(edges)),
            evidence=evidence,
        )
