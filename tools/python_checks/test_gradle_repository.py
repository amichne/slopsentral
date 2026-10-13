from __future__ import annotations

import subprocess
from typing import TYPE_CHECKING, Never

import gradle_repository
import pytest
from gradle_repository import (
    DirectorySelection,
    ProjectDirectory,
    ResolutionFailure,
    resolve_project_directory,
)

if TYPE_CHECKING:
    from pathlib import Path


def test_nested_directory_selects_real_git_root(tmp_path: Path) -> None:
    repository = tmp_path / "repository with spaces"
    initialized = subprocess.run(
        ["git", "init", "--quiet", str(repository)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert initialized.returncode == 0, initialized.stderr
    nested = repository / "app/src/main/kotlin"
    nested.mkdir(parents=True)

    outcome = resolve_project_directory(nested)

    assert isinstance(outcome, ProjectDirectory)
    assert outcome.path == repository.resolve()
    assert outcome.selection is DirectorySelection.GIT_ROOT


def test_standalone_directory_preserves_legacy_fallback(tmp_path: Path) -> None:
    outcome = resolve_project_directory(tmp_path)

    assert isinstance(outcome, ProjectDirectory)
    assert outcome.path == tmp_path.resolve()
    assert outcome.selection is DirectorySelection.DIRECTORY_FALLBACK


def test_missing_directory_is_rejected_before_git(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def unexpected_git(*_args: object, **_kwargs: object) -> Never:
        pytest.fail("Git must not run for a missing directory")

    monkeypatch.setattr(gradle_repository.subprocess, "run", unexpected_git)

    assert resolve_project_directory(tmp_path / "missing") is ResolutionFailure.INVALID_DIRECTORY


@pytest.mark.parametrize("error_type", [FileNotFoundError, PermissionError])
def test_git_launch_failure_cannot_select_directory_fallback(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, error_type: type[OSError]
) -> None:
    def unavailable_git(*_args: object, **_kwargs: object) -> Never:
        raise error_type

    monkeypatch.setattr(gradle_repository.subprocess, "run", unavailable_git)

    assert resolve_project_directory(tmp_path) is ResolutionFailure.GIT_UNAVAILABLE


@pytest.mark.parametrize("output", ["", ".\n", "relative/repository\n"])
def test_successful_git_with_malformed_root_is_rejected(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, output: str
) -> None:
    def malformed_git(*_args: object, **_kwargs: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(["git"], 0, stdout=output, stderr="")

    monkeypatch.setattr(gradle_repository.subprocess, "run", malformed_git)

    assert resolve_project_directory(tmp_path) is ResolutionFailure.INVALID_GIT_ROOT


def test_successful_git_with_missing_root_is_rejected(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def missing_root(*_args: object, **_kwargs: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            ["git"], 0, stdout=str(tmp_path / "missing") + "\n", stderr=""
        )

    monkeypatch.setattr(gradle_repository.subprocess, "run", missing_root)

    assert resolve_project_directory(tmp_path) is ResolutionFailure.INVALID_GIT_ROOT
