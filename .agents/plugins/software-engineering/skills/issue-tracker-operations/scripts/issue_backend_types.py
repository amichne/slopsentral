from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Generic, TypeVar


class Backend(str, Enum):
    GITHUB = "GITHUB"
    JIRA = "JIRA"


class Operation(str, Enum):
    CAPABILITIES = "CAPABILITIES"
    VIEW = "VIEW"
    DEPENDENCY_MAP = "DEPENDENCY_MAP"


class Outcome(str, Enum):
    COMPLETE = "COMPLETE"
    REJECTED = "REJECTED"


class Capability(str, Enum):
    DIRECT_BLOCKER_MAP = "DIRECT_BLOCKER_MAP"
    VIEW = "VIEW"
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    COMMENT = "COMMENT"
    HIERARCHY_MAP = "HIERARCHY_MAP"


class Support(str, Enum):
    NATIVE = "NATIVE"
    UNSUPPORTED = "UNSUPPORTED"


class Relation(str, Enum):
    BLOCKS = "BLOCKS"


@dataclass(frozen=True)
class CapabilityState:
    name: Capability
    support: Support

    def to_dict(self) -> dict[str, str]:
        return {
            "type": "ISSUE_BACKEND_CAPABILITY",
            "name": self.name.value,
            "support": self.support.value,
        }


@dataclass(frozen=True)
class IssueIdentity:
    identifier: str
    title: str | None
    state: str | None = None
    url: str | None = None

    def to_issue_dict(self) -> dict[str, str]:
        result = {
            "type": "ISSUE_BACKEND_ISSUE",
            "id": self.identifier,
        }
        if self.state is not None:
            result["state"] = self.state
        if self.title is not None:
            result["title"] = self.title
        if self.url is not None:
            result["url"] = self.url
        return result

    def to_reference_dict(self) -> dict[str, str]:
        result = {
            "type": "ISSUE_BACKEND_ISSUE_REFERENCE",
            "id": self.identifier,
        }
        if self.title is not None:
            result["title"] = self.title
        return result


@dataclass(frozen=True)
class DependencyEdge:
    source: IssueIdentity
    target: IssueIdentity
    relation: Relation = Relation.BLOCKS

    def to_dict(self) -> dict[str, object]:
        return {
            "type": "ISSUE_BACKEND_DEPENDENCY_EDGE",
            "relation": self.relation.value,
            "source": self.source.to_reference_dict(),
            "target": self.target.to_reference_dict(),
        }


@dataclass(frozen=True)
class DependencyMap:
    root: str
    edges: tuple[DependencyEdge, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "type": "ISSUE_BACKEND_DEPENDENCY_MAP",
            "root": self.root,
            "edges": [edge.to_dict() for edge in self.edges],
            "coverage": {
                "type": "ISSUE_BACKEND_DEPENDENCY_COVERAGE",
                "depth": 1,
                "directBlockers": "COMPLETE",
                "hierarchy": "UNSUPPORTED",
                "transitive": "UNSUPPORTED",
            },
        }


@dataclass(frozen=True)
class CommandEvidence:
    executable: str
    arguments: tuple[str, ...]
    exit_code: int

    def to_dict(self) -> dict[str, object]:
        return {
            "type": "ISSUE_BACKEND_COMMAND_EVIDENCE",
            "executable": self.executable,
            "arguments": list(self.arguments),
            "exitCode": self.exit_code,
        }


T = TypeVar("T")


@dataclass(frozen=True)
class ProviderObservation(Generic[T]):
    value: T
    evidence: tuple[CommandEvidence, ...]


class IssueBackendError(Exception):
    def __init__(
        self,
        failure_id: str,
        message: str,
        recovery: str,
        evidence: tuple[CommandEvidence, ...] = (),
    ) -> None:
        super().__init__(message)
        self.failure_id = failure_id
        self.message = message
        self.recovery = recovery
        self.evidence = evidence


def capabilities() -> tuple[CapabilityState, ...]:
    return (
        CapabilityState(Capability.DIRECT_BLOCKER_MAP, Support.NATIVE),
        CapabilityState(Capability.VIEW, Support.NATIVE),
        CapabilityState(Capability.CREATE, Support.UNSUPPORTED),
        CapabilityState(Capability.UPDATE, Support.UNSUPPORTED),
        CapabilityState(Capability.COMMENT, Support.UNSUPPORTED),
        CapabilityState(Capability.HIERARCHY_MAP, Support.UNSUPPORTED),
    )


def success_envelope(backend: Backend, operation: Operation) -> dict[str, object]:
    result_type = {
        Operation.CAPABILITIES: "ISSUE_BACKEND_CAPABILITIES_RESULT",
        Operation.VIEW: "ISSUE_BACKEND_VIEW_RESULT",
        Operation.DEPENDENCY_MAP: "ISSUE_BACKEND_DEPENDENCY_MAP_RESULT",
    }[operation]
    return {
        "type": "ISSUE_BACKEND_RESULT",
        "schemaVersion": 1,
        "result": {
            "type": result_type,
            "outcome": Outcome.COMPLETE.value,
            "backend": backend.value,
            "operation": operation.value,
        },
    }


def failure_envelope(
    error: IssueBackendError,
    backend: Backend | None,
    operation: Operation | None,
) -> dict[str, object]:
    failure_result: dict[str, object] = {
        "type": "ISSUE_BACKEND_FAILURE",
        "outcome": Outcome.REJECTED.value,
        "failure": {
            "type": "ISSUE_BACKEND_FAILURE_DETAIL",
            "id": error.failure_id,
            "message": error.message,
            "mutationState": "NOT_STARTED",
            "recoverability": error.recovery,
        },
        "evidence": [item.to_dict() for item in error.evidence],
    }
    if backend is not None:
        failure_result["backend"] = backend.value
    if operation is not None:
        failure_result["operation"] = operation.value
    return {
        "type": "ISSUE_BACKEND_RESULT",
        "schemaVersion": 1,
        "result": failure_result,
    }
