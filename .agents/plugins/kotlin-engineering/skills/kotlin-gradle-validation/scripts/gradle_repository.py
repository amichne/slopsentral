"""Select the Git root, with the established standalone-directory fallback."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path


class DirectorySelection(StrEnum):
    GIT_ROOT = "git-root"
    DIRECTORY_FALLBACK = "directory-fallback"


class ResolutionFailure(StrEnum):
    INVALID_DIRECTORY = "repository directory is unavailable"
    GIT_UNAVAILABLE = "Git root discovery is unavailable"
    INVALID_GIT_ROOT = "Git returned an invalid root"


@dataclass(frozen=True, slots=True)
class _DirectoryEvidence:
    path: Path
    selection: DirectorySelection


@dataclass(frozen=True, slots=True)
class ProjectDirectory:
    _evidence: _DirectoryEvidence

    @property
    def path(self) -> Path:
        return self._evidence.path

    @property
    def selection(self) -> DirectorySelection:
        return self._evidence.selection


def resolve_project_directory(requested: Path) -> ProjectDirectory | ResolutionFailure:
    try:
        directory = requested.resolve(strict=True)
        if not directory.is_dir():
            return ResolutionFailure.INVALID_DIRECTORY
    except (OSError, RuntimeError):
        return ResolutionFailure.INVALID_DIRECTORY
    try:
        result = subprocess.run(
            ["git", "-C", str(directory), "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=False,
        )
    except (OSError, UnicodeError):
        return ResolutionFailure.GIT_UNAVAILABLE
    if result.returncode:
        return ProjectDirectory(
            _DirectoryEvidence(directory, DirectorySelection.DIRECTORY_FALLBACK)
        )
    return _select_git_root(directory, result.stdout.removesuffix("\n"))


def _select_git_root(directory: Path, root_text: str) -> ProjectDirectory | ResolutionFailure:
    if not root_text or "\n" in root_text or "\0" in root_text:
        return ResolutionFailure.INVALID_GIT_ROOT
    try:
        root_path = Path(root_text)
        if not root_path.is_absolute():
            return ResolutionFailure.INVALID_GIT_ROOT
        root = root_path.resolve(strict=True)
        if not root.is_dir() or not directory.is_relative_to(root):
            return ResolutionFailure.INVALID_GIT_ROOT
    except (OSError, RuntimeError):
        return ResolutionFailure.INVALID_GIT_ROOT
    return ProjectDirectory(_DirectoryEvidence(root, DirectorySelection.GIT_ROOT))
