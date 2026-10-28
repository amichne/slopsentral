from __future__ import annotations

import base64
import copy
import json
import os
import subprocess
import sys
from typing import TYPE_CHECKING

import pytest

from tools import pi_candidate, release_version
from tools.pi_candidate import CandidateError, mapping

if TYPE_CHECKING:
    from pathlib import Path

REPOSITORY = "amichne/slopsentral"
REVISION = "a" * 40
BASE = "b" * 40
AUTHOR = "slopsentral-release-please[bot]"
RUN = f"repos/{REPOSITORY}/actions/runs/123"
JOBS = f"{RUN}/attempts/1/jobs?per_page=100"
PULL = f"repos/{REPOSITORY}/pulls/42"
ASSOCIATED = f"repos/{REPOSITORY}/commits/{REVISION}/pulls?per_page=100"
FILES = [
    "package.json",
    "package-lock.json",
    ".release-please-manifest.json",
    "CHANGELOG.md",
    "pyproject.toml",
    "uv.lock",
    "source/adaptable.marketplace.json",
    "source/plugins/software-engineering/plugin.json",
    "source/plugins/kotlin-engineering/plugin.json",
    "source/plugins/intellij-plugin-development/plugin.json",
    "source/plugins/repository-knowledge/plugin.json",
    "source/plugins/developer-tooling/plugin.json",
]


def content(version: str) -> dict[str, str]:
    return {
        "encoding": "base64",
        "content": base64.b64encode(json.dumps({"version": version}).encode()).decode(),
    }


@pytest.fixture
def documents(monkeypatch: pytest.MonkeyPatch) -> dict[str, object]:
    pull = {
        "number": 42,
        "state": "open",
        "draft": False,
        "changed_files": len(FILES),
        "head": {
            "ref": release_version.RELEASE_BRANCH,
            "sha": REVISION,
            "repo": {"full_name": REPOSITORY},
        },
        "base": {"ref": "main", "sha": BASE, "repo": {"full_name": REPOSITORY}},
        "user": {"login": AUTHOR, "type": "Bot"},
        "labels": [{"name": "autorelease: pending"}],
    }
    values: dict[str, object] = {
        RUN: {
            "repository": {"full_name": REPOSITORY},
            "head_repository": {"full_name": REPOSITORY},
            "path": ".github/workflows/validate-source.yml",
            "head_sha": REVISION,
            "id": 123,
            "run_attempt": 1,
            "run_number": 900,
            "status": "completed",
            "conclusion": "success",
            "event": "pull_request",
            "head_branch": release_version.RELEASE_BRANCH,
            "actor": {"login": AUTHOR},
        },
        JOBS: {
            "total_count": 2,
            "jobs": [
                {
                    "name": "Validate marketplace source",
                    "status": "completed",
                    "conclusion": "success",
                },
                {
                    "name": "Retain tested Pi candidate",
                    "status": "completed",
                    "conclusion": "success",
                },
            ],
        },
        ASSOCIATED: [copy.deepcopy(pull)],
        PULL: pull,
        f"{PULL}/files?per_page=100": [{"filename": name, "status": "modified"} for name in FILES],
        f"repos/{REPOSITORY}/contents/package.json?ref={REVISION}": content("4.0.5"),
        f"repos/{REPOSITORY}/contents/package.json?ref={BASE}": content("4.0.4"),
    }
    monkeypatch.setattr(release_version, "observe", values.__getitem__)
    monkeypatch.setattr(pi_candidate, "observe", values.__getitem__)

    def forbidden(_: list[str]) -> str:
        pytest.fail("PR admission must not merge or mutate repository state")

    monkeypatch.setattr(release_version, "run_command", forbidden)
    return values


def test_exact_app_authored_patch_with_both_successful_jobs_is_admitted(
    documents: dict[str, object],
) -> None:
    assert documents
    result = release_version.admit_pr(REPOSITORY, REVISION, 123, AUTHOR)
    assert (result.number, result.revision, result.version) == (42, REVISION, "4.0.5")


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("event", "push"),
        ("head_branch", "feature"),
        ("conclusion", "failure"),
        ("head_repository", {"full_name": "other/slopsentral"}),
        ("actor", {"login": "other[bot]"}),
    ],
)
def test_wrong_run_cannot_authorize_a_merge(
    documents: dict[str, object], field: str, value: object
) -> None:
    run = documents[RUN]
    assert mapping(run)
    run[field] = value
    with pytest.raises(CandidateError):
        _ = release_version.admit_pr(REPOSITORY, REVISION, 123, AUTHOR)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("draft", True),
        ("state", "closed"),
        ("labels", []),
        ("user", {"login": "other[bot]", "type": "Bot"}),
        ("user", {"login": AUTHOR, "type": "User"}),
        (
            "head",
            {"ref": release_version.RELEASE_BRANCH, "sha": BASE, "repo": {"full_name": REPOSITORY}},
        ),
        (
            "head",
            {
                "ref": release_version.RELEASE_BRANCH,
                "sha": REVISION,
                "repo": {"full_name": "other/slopsentral"},
            },
        ),
        ("base", {"ref": "feature", "sha": BASE, "repo": {"full_name": REPOSITORY}}),
    ],
)
def test_changed_foreign_or_unapproved_pr_is_rejected(
    documents: dict[str, object], field: str, value: object
) -> None:
    pull = documents[PULL]
    assert mapping(pull)
    pull[field] = value
    with pytest.raises(CandidateError):
        _ = release_version.admit_pr(REPOSITORY, REVISION, 123, AUTHOR)


@pytest.mark.parametrize("replacement", ["tools/ci.py", ".github/workflows/release-pi.yml"])
def test_code_changes_cannot_enter_through_a_version_pr(
    documents: dict[str, object], replacement: str
) -> None:
    documents[f"{PULL}/files?per_page=100"] = [
        {"filename": name if index else replacement, "status": "modified"}
        for index, name in enumerate(FILES)
    ]
    with pytest.raises(CandidateError):
        _ = release_version.admit_pr(REPOSITORY, REVISION, 123, AUTHOR)


@pytest.mark.parametrize("version", ["4.0.4", "4.0.6", "4.1.0"])
def test_only_the_next_patch_is_a_version_pr(documents: dict[str, object], version: str) -> None:
    documents[f"repos/{REPOSITORY}/contents/package.json?ref={REVISION}"] = content(version)
    with pytest.raises(CandidateError):
        _ = release_version.admit_pr(REPOSITORY, REVISION, 123, AUTHOR)


@pytest.mark.parametrize("conclusion", ["failure", "skipped"])
def test_workflow_success_does_not_replace_required_job_success(
    documents: dict[str, object], conclusion: str
) -> None:
    documents[JOBS] = {
        "total_count": 2,
        "jobs": [
            {"name": "Validate marketplace source", "status": "completed", "conclusion": "success"},
            {"name": "Retain tested Pi candidate", "status": "completed", "conclusion": conclusion},
        ],
    }
    with pytest.raises(CandidateError):
        _ = release_version.admit_pr(REPOSITORY, REVISION, 123, AUTHOR)


def test_ambiguous_pr_identity_is_not_resolved_by_list_order(documents: dict[str, object]) -> None:
    documents[ASSOCIATED] = [documents[PULL], documents[PULL]]
    with pytest.raises(CandidateError):
        _ = release_version.admit_pr(REPOSITORY, REVISION, 123, AUTHOR)


def test_incomplete_file_inventory_cannot_authorize_a_merge(documents: dict[str, object]) -> None:
    documents[f"{PULL}/files?per_page=100"] = []
    with pytest.raises(CandidateError):
        _ = release_version.admit_pr(REPOSITORY, REVISION, 123, AUTHOR)


def test_public_admission_command_emits_only_the_bound_pr_and_head(
    documents: dict[str, object],
    tmp_path: Path,
) -> None:
    data = tmp_path / "responses.json"
    _ = data.write_text(json.dumps(documents))
    binary = tmp_path / "bin"
    binary.mkdir()
    gh = binary / "gh"
    _ = gh.write_text(
        f"#!{sys.executable}\n"
        "import json, sys\n"
        f"responses = json.load(open({str(data)!r}))\n"
        "if len(sys.argv) != 3 or sys.argv[1] != 'api': raise SystemExit(9)\n"
        "print(json.dumps(responses[sys.argv[2]]))\n"
    )
    gh.chmod(0o700)
    output = tmp_path / "outputs with spaces"
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "tools.release_version",
            "admit-pr",
            "--repository",
            REPOSITORY,
            "--revision",
            REVISION,
            "--run-id",
            "123",
            "--author",
            AUTHOR,
            "--github-output",
            str(output),
        ],
        cwd=release_version.ROOT,
        env={**os.environ, "PATH": str(binary) + os.pathsep + os.environ["PATH"]},
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout) == {
        "type": "RELEASE_VERSION",
        "pull_request": "42",
        "revision": REVISION,
        "version": "4.0.5",
    }
    assert output.read_text() == f"pull_request=42\nrevision={REVISION}\nversion=4.0.5\n"
