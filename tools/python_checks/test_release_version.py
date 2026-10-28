from __future__ import annotations

import base64
import json
import shutil
from pathlib import Path

import pytest

from tools import pi_candidate, release_version
from tools.pi_candidate import CandidateError, Failure

ROOT = Path(__file__).resolve().parents[2]
REPOSITORY = "amichne/slopsentral"
REVISION = "a" * 40
PARENT = "b" * 40


def checkout(tmp_path: Path) -> Path:
    for name in [
        "package.json",
        "package-lock.json",
        "pyproject.toml",
        "uv.lock",
        ".release-please-manifest.json",
        "release-please-config.json",
        "source/adaptable.marketplace.json",
        *(str(path.relative_to(ROOT)) for path in (ROOT / "source/plugins").glob("*/plugin.json")),
    ]:
        target = tmp_path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        _ = shutil.copyfile(ROOT / name, target)
    return tmp_path


def test_all_authored_versions_and_release_please_targets_match() -> None:
    assert release_version.check(ROOT) == release_version.document(ROOT / "package.json")["version"]


@pytest.mark.parametrize(
    "name",
    [
        "package.json",
        "package-lock.json",
        ".release-please-manifest.json",
        "source/plugins/software-engineering/plugin.json",
        "source/adaptable.marketplace.json",
        "pyproject.toml",
        "uv.lock",
    ],
)
def test_version_drift_is_rejected(tmp_path: Path, name: str) -> None:
    root = checkout(tmp_path)
    version = release_version.check(root)
    path = root / name
    _ = path.write_text(path.read_text().replace(version, "99.0.0", 1))
    with pytest.raises(CandidateError, match=Failure.PAYLOAD_MISMATCH):
        _ = release_version.check(root)


def test_release_please_must_update_every_manifest(tmp_path: Path) -> None:
    root = checkout(tmp_path)
    path = root / "release-please-config.json"
    value = release_version.document(path)
    packages = value["packages"]
    assert pi_candidate.mapping(packages)
    package = packages["."]
    assert pi_candidate.mapping(package)
    extra = package["extra-files"]
    assert pi_candidate.sequence(extra)
    _ = extra.pop()
    _ = path.write_text(json.dumps(value))
    with pytest.raises(CandidateError, match=Failure.PAYLOAD_MISMATCH):
        _ = release_version.check(root)


def responses(current: str = "4.0.1", previous: str = "4.0.0") -> dict[str, object]:
    def content(version: str) -> dict[str, str]:
        return {
            "encoding": "base64",
            "content": base64.b64encode(json.dumps({"version": version}).encode()).decode(),
        }

    return {
        f"repos/{REPOSITORY}/actions/runs/123": {
            "repository": {"full_name": REPOSITORY},
            "path": ".github/workflows/validate-source.yml",
            "head_sha": REVISION,
            "id": 123,
            "run_attempt": 1,
            "run_number": 900,
            "status": "completed",
            "conclusion": "success",
            "event": "push",
            "head_branch": "main",
        },
        f"repos/{REPOSITORY}/git/commits/{REVISION}": {
            "sha": REVISION,
            "parents": [{"sha": PARENT}],
        },
        f"repos/{REPOSITORY}/contents/package.json?ref={REVISION}": content(current),
        f"repos/{REPOSITORY}/contents/package.json?ref={PARENT}": content(previous),
        f"repos/{REPOSITORY}/releases/latest": {
            "tag_name": "slopsentral-v4.0.1",
            "draft": False,
            "prerelease": False,
        },
    }


@pytest.mark.parametrize(("previous", "release"), [("4.0.0", True), ("4.0.1", False)])
def test_only_a_version_increment_selects_a_release(
    monkeypatch: pytest.MonkeyPatch, previous: str, *, release: bool
) -> None:
    documents = responses(previous=previous)
    documents[f"repos/{REPOSITORY}/releases/latest"] = {
        "tag_name": f"slopsentral-v{previous}",
        "draft": False,
        "prerelease": False,
    }
    monkeypatch.setattr(release_version, "observe", documents.__getitem__)
    monkeypatch.setattr(pi_candidate, "observe", documents.__getitem__)
    assert release_version.select(REPOSITORY, REVISION, 123) == release_version.Selection(
        REVISION, "4.0.1", release
    )


def test_a_later_successful_main_run_keeps_an_unpublished_version_increment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    documents = responses(current="4.0.2", previous="4.0.2")
    monkeypatch.setattr(release_version, "observe", documents.__getitem__)
    monkeypatch.setattr(pi_candidate, "observe", documents.__getitem__)
    assert release_version.select(REPOSITORY, REVISION, 123) == release_version.Selection(
        REVISION,
        "4.0.2",
        release=True,
    )


def test_an_already_published_version_is_not_selected_again(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    documents = responses(current="4.0.1", previous="4.0.0")
    monkeypatch.setattr(release_version, "observe", documents.__getitem__)
    monkeypatch.setattr(pi_candidate, "observe", documents.__getitem__)
    assert release_version.select(REPOSITORY, REVISION, 123).release is False


@pytest.mark.parametrize(
    "published",
    [
        {"tag_name": "pi-v4.0.1", "draft": False, "prerelease": False},
        {"tag_name": "slopsentral-v4.0.1", "draft": True, "prerelease": False},
        {"tag_name": "slopsentral-v4.0.1", "draft": False, "prerelease": True},
        {"tag_name": "slopsentral-v4.0.1-beta", "draft": False, "prerelease": False},
    ],
)
def test_release_selection_rejects_an_invalid_published_baseline(
    monkeypatch: pytest.MonkeyPatch,
    published: dict[str, object],
) -> None:
    documents = responses()
    documents[f"repos/{REPOSITORY}/releases/latest"] = published
    monkeypatch.setattr(release_version, "observe", documents.__getitem__)
    monkeypatch.setattr(pi_candidate, "observe", documents.__getitem__)
    with pytest.raises(CandidateError, match=Failure.INVALID_RECORD):
        _ = release_version.select(REPOSITORY, REVISION, 123)


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("event", "pull_request"),
        ("head_branch", "feature"),
        ("conclusion", "failure"),
        ("head_sha", PARENT),
    ],
)
def test_release_selection_rejects_the_wrong_run(
    monkeypatch: pytest.MonkeyPatch, key: str, value: str
) -> None:
    documents = responses()
    run = documents[f"repos/{REPOSITORY}/actions/runs/123"]
    assert pi_candidate.mapping(run)
    run[key] = value
    monkeypatch.setattr(release_version, "observe", documents.__getitem__)
    monkeypatch.setattr(pi_candidate, "observe", documents.__getitem__)
    with pytest.raises(CandidateError):
        _ = release_version.select(REPOSITORY, REVISION, 123)


def test_version_downgrades_are_not_release_transitions(monkeypatch: pytest.MonkeyPatch) -> None:
    documents = responses(previous="5.0.0")
    monkeypatch.setattr(release_version, "observe", documents.__getitem__)
    monkeypatch.setattr(pi_candidate, "observe", documents.__getitem__)
    with pytest.raises(CandidateError, match=Failure.INVALID_IDENTITY):
        _ = release_version.select(REPOSITORY, REVISION, 123)


def test_finalize_labels_only_after_a_matching_published_source_tag(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    documents = responses()
    documents[f"repos/{REPOSITORY}/commits/{REVISION}/pulls?per_page=100"] = [
        {
            "number": 42,
            "merged_at": "now",
            "merge_commit_sha": REVISION,
            "labels": [{"name": "autorelease: pending"}],
        }
    ]
    documents[
        f"repos/{REPOSITORY}/issues?state=closed&labels=autorelease%3A%20pending&per_page=100"
    ] = [
        {"number": 42, "pull_request": {}, "labels": [{"name": "autorelease: pending"}]},
    ]
    documents[f"repos/{REPOSITORY}/pulls/42"] = {
        "merged_at": "now",
        "merge_commit_sha": REVISION,
        "base": {"ref": "main"},
    }
    documents[f"repos/{REPOSITORY}/releases/tags/slopsentral-v4.0.1"] = {
        "draft": False,
        "prerelease": False,
    }
    target: dict[str, object] = {"object": {"type": "commit", "sha": REVISION}}
    documents[f"repos/{REPOSITORY}/git/ref/tags/slopsentral-v4.0.1"] = target
    calls: list[list[str]] = []

    def run(arguments: list[str]) -> str:
        calls.append(arguments)
        return ""

    monkeypatch.setattr(release_version, "observe", documents.__getitem__)
    monkeypatch.setattr(pi_candidate, "observe", documents.__getitem__)
    monkeypatch.setattr(release_version, "run_command", run)
    release_version.finalize(REPOSITORY, REVISION)
    assert calls[-1] == [
        "gh",
        "pr",
        "edit",
        "42",
        "--repo",
        REPOSITORY,
        "--remove-label",
        "autorelease: pending",
        "--add-label",
        "autorelease: tagged",
    ]
    target["object"] = {"type": "commit", "sha": PARENT}
    calls.clear()
    with pytest.raises(CandidateError, match=Failure.WRONG_PRODUCER):
        release_version.finalize(REPOSITORY, REVISION)
    assert calls == []
    documents[f"repos/{REPOSITORY}/commits/{REVISION}/pulls?per_page=100"] = []
    documents[
        f"repos/{REPOSITORY}/issues?state=closed&labels=autorelease%3A%20pending&per_page=100"
    ] = []
    release_version.finalize(REPOSITORY, REVISION)
    assert calls == []


def test_a_repair_release_completes_the_original_version_pr(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repair = "c" * 40
    documents = responses()
    documents[f"repos/{REPOSITORY}/commits/{repair}/pulls?per_page=100"] = []
    documents[f"repos/{REPOSITORY}/contents/package.json?ref={repair}"] = documents[
        f"repos/{REPOSITORY}/contents/package.json?ref={REVISION}"
    ]
    documents[
        f"repos/{REPOSITORY}/issues?state=closed&labels=autorelease%3A%20pending&per_page=100"
    ] = [
        {"number": 42, "pull_request": {}, "labels": [{"name": "autorelease: pending"}]},
    ]
    documents[f"repos/{REPOSITORY}/pulls/42"] = {
        "merged_at": "now",
        "merge_commit_sha": REVISION,
        "base": {"ref": "main"},
    }
    comparison: dict[str, object] = {"status": "ahead"}
    documents[f"repos/{REPOSITORY}/compare/{REVISION}...{repair}"] = comparison
    documents[f"repos/{REPOSITORY}/releases/tags/slopsentral-v4.0.1"] = {
        "draft": False,
        "prerelease": False,
    }
    documents[f"repos/{REPOSITORY}/git/ref/tags/slopsentral-v4.0.1"] = {
        "object": {"type": "commit", "sha": repair},
    }
    calls: list[list[str]] = []

    def run(arguments: list[str]) -> str:
        calls.append(arguments)
        return ""

    monkeypatch.setattr(release_version, "observe", documents.__getitem__)
    monkeypatch.setattr(pi_candidate, "observe", documents.__getitem__)
    monkeypatch.setattr(release_version, "run_command", run)
    release_version.finalize(REPOSITORY, repair)
    assert calls, "Publication must complete the original pending version PR"
    assert calls[-1][-4:] == [
        "--remove-label",
        "autorelease: pending",
        "--add-label",
        "autorelease: tagged",
    ]
    assert calls[-1][3] == "42"
    comparison["status"] = "diverged"
    calls.clear()
    with pytest.raises(CandidateError, match=Failure.WRONG_PRODUCER):
        release_version.finalize(REPOSITORY, repair)
    assert calls == []
