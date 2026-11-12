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


def _jira_issue(value: object) -> IssueIdentity:
    issue = _mapping(value, "work item")
    fields_value = issue.get("fields", {})
    fields = _mapping(fields_value, "work item fields")
    identifier = _optional_text(issue.get("key")) or _optional_text(issue.get("id"))
    if identifier is None:
        raise IssueBackendError(
            "PROVIDER_OUTPUT_INVALID",
            "The acli result omitted the Jira work item key.",
            "UPDATE_OR_RECONFIGURE_PROVIDER_CLI",
        )
    return IssueIdentity(
        identifier=identifier,
        title=_optional_text(fields.get("summary")) or _optional_text(issue.get("summary")),
        state=_status_name(fields.get("status")) or _status_name(issue.get("status")),
        url=_optional_text(issue.get("url")),
    )


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


class JiraProvider:
    backend = Backend.JIRA

    def __init__(self, runner: CommandRunner) -> None:
        self._runner = runner

    def view(self, identifier: str) -> ProviderObservation[IssueIdentity]:
        arguments = ["jira", "workitem", "view", identifier, "--json"]
        output = self._runner.run("acli", arguments)
        try:
            issue = _jira_issue(_parse_json(output))
        except IssueBackendError as error:
            raise _attach_evidence(error, (output.evidence,)) from error
        return ProviderObservation(value=issue, evidence=(output.evidence,))

    def dependency_map(self, identifier: str) -> ProviderObservation[DependencyMap]:
        arguments = ["jira", "workitem", "link", "list", "--key", identifier, "--json"]
        output = self._runner.run("acli", arguments)
        try:
            payload = _parse_json(output)
            if isinstance(payload, list):
                links = payload
            else:
                links_value = payload.get("links")
                if not isinstance(links_value, list):
                    raise IssueBackendError(
                        "PROVIDER_OUTPUT_INVALID",
                        "The acli link result omitted the links array.",
                        "UPDATE_OR_RECONFIGURE_PROVIDER_CLI",
                    )
                links = links_value

            root = IssueIdentity(identifier=identifier, title=None)
            edges: list[DependencyEdge] = []
            for raw_link in links:
                link = _mapping(raw_link, "work item link")
                link_type = _mapping(link.get("type", {}), "work item link type")
                if (_optional_text(link_type.get("name")) or "").casefold() != "blocks":
                    continue
                inward = link.get("inwardIssue", link.get("inwardWorkItem"))
                outward = link.get("outwardIssue", link.get("outwardWorkItem"))
                if inward is not None:
                    edges.append(DependencyEdge(source=_jira_issue(inward), target=root))
                if outward is not None:
                    edges.append(DependencyEdge(source=root, target=_jira_issue(outward)))
        except IssueBackendError as error:
            raise _attach_evidence(error, (output.evidence,)) from error

        return ProviderObservation(
            value=DependencyMap(root=identifier, edges=tuple(edges)),
            evidence=(output.evidence,),
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
