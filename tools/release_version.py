# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = []
# [tool.uv]
# no-build = true
# required-version = ">=0.12.9"
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""Verify the shared authored version and select source-bound release commits."""

from __future__ import annotations

import argparse
import json
import re
import tomllib
from dataclasses import dataclass
from pathlib import Path

from tools.pi_candidate import (
    PAGE_SIZE,
    REPOSITORY,
    VERSION,
    CandidateError,
    Failure,
    listing,
    load,
    mapping,
    number_field,
    observe,
    positive,
    require_identity,
    run_command,
    sequence,
    source_version,
    successful_run,
    text_field,
)

ROOT = Path(__file__).resolve().parents[1]
RELEASE_BRANCH = "release-please--branches--main--components--slopsentral"


def document(path: Path) -> dict[str, object]:
    value = load(path.read_bytes())
    if not mapping(value):
        raise CandidateError(Failure.INVALID_RECORD)
    return value


def check(root: Path) -> str:
    version = text_field(document(root / "package.json"), "version")
    if not VERSION.fullmatch(version):
        raise CandidateError(Failure.INVALID_RECORD)
    if document(root / ".release-please-manifest.json") != {".": version}:
        raise CandidateError(Failure.PAYLOAD_MISMATCH)
    lock = document(root / "package-lock.json")
    packages = lock.get("packages")
    if not mapping(packages) or not mapping(package := packages.get("")):
        raise CandidateError(Failure.INVALID_RECORD)
    python: object = tomllib.loads((root / "pyproject.toml").read_text())
    if not mapping(python) or not mapping(project := python.get("project")):
        raise CandidateError(Failure.INVALID_RECORD)
    if any(
        value != version
        for value in [
            lock.get("version"),
            package.get("version"),
            project.get("version"),
            python_lock_version(root),
        ]
    ):
        raise CandidateError(Failure.PAYLOAD_MISMATCH)
    manifests = check_plugins(root, version)
    check_config(root, manifests)
    return version


def python_lock_version(root: Path) -> object:
    lock: object = tomllib.loads((root / "uv.lock").read_text())
    if not mapping(lock) or not sequence(packages := lock.get("package")):
        raise CandidateError(Failure.INVALID_RECORD)
    versions = [
        package.get("version")
        for package in packages
        if mapping(package) and package.get("name") == "slopsentral-automation"
    ]
    if len(versions) != 1:
        raise CandidateError(Failure.INVALID_RECORD)
    return versions[0]


def check_plugins(root: Path, version: str) -> list[Path]:
    marketplace = document(root / "source/adaptable.marketplace.json")
    if not sequence(entries := marketplace.get("plugins")):
        raise CandidateError(Failure.INVALID_RECORD)
    manifests = sorted((root / "source/plugins").glob("*/plugin.json"))
    names = {text_field(document(path), "name") for path in manifests}
    selected: list[str] = []
    for entry in entries:
        if not mapping(entry) or not mapping(reference := entry.get("plugin")):
            raise CandidateError(Failure.INVALID_RECORD)
        selected.append(text_field(entry, "name"))
        if reference.get("version") != version:
            raise CandidateError(Failure.PAYLOAD_MISMATCH)
    if set(selected) != names or len(selected) != len(names):
        raise CandidateError(Failure.PAYLOAD_MISMATCH)
    if any(document(path).get("version") != version for path in manifests):
        raise CandidateError(Failure.PAYLOAD_MISMATCH)
    return manifests


def check_config(root: Path, manifests: list[Path]) -> None:
    config = document(root / "release-please-config.json")
    required = {
        "release-type": "node",
        "versioning": "always-bump-patch",
        "skip-github-release": True,
        "include-component-in-tag": True,
        "include-v-in-tag": True,
        "tag-separator": "-",
    }
    if set(config) != {"$schema", "bootstrap-sha", "packages", *required} or any(
        config.get(key) != value or type(config.get(key)) is not type(value)
        for key, value in required.items()
    ):
        raise CandidateError(Failure.INVALID_RECORD)
    units = config.get("packages")
    if not mapping(units) or set(units) != {"."} or not mapping(unit := units["."]):
        raise CandidateError(Failure.INVALID_RECORD)
    if unit.get("component") != "slopsentral" or set(unit) != {
        "component",
        "changelog-path",
        "exclude-paths",
        "extra-files",
    }:
        raise CandidateError(Failure.INVALID_RECORD)
    expected = [
        {"type": "toml", "path": "pyproject.toml", "jsonpath": "$.project.version"},
        {
            "type": "toml",
            "path": "uv.lock",
            "jsonpath": "$.package[?(@.name.value == 'slopsentral-automation')].version",
        },
        {
            "type": "json",
            "path": "source/adaptable.marketplace.json",
            "jsonpath": "$.plugins[*].plugin.version",
        },
        *(
            {"type": "json", "path": path.relative_to(root).as_posix(), "jsonpath": "$.version"}
            for path in manifests
        ),
    ]
    actual = unit.get("extra-files")
    if not sequence(actual) or sorted(
        json.dumps(item, sort_keys=True) for item in actual
    ) != sorted(json.dumps(item, sort_keys=True) for item in expected):
        raise CandidateError(Failure.PAYLOAD_MISMATCH)


@dataclass(frozen=True, slots=True)
class Selection:
    revision: str
    version: str
    release: bool


@dataclass(frozen=True, slots=True)
class _ValidatedReleasePr:
    number: int
    revision: str
    version: str


def _release_paths() -> frozenset[str]:
    config = document(ROOT / "release-please-config.json")
    if not mapping(packages := config.get("packages")) or not mapping(unit := packages.get(".")):
        raise CandidateError(Failure.INVALID_RECORD)
    if not sequence(extra := unit.get("extra-files")):
        raise CandidateError(Failure.INVALID_RECORD)
    paths = {
        "package.json",
        "package-lock.json",
        ".release-please-manifest.json",
        text_field(unit, "changelog-path"),
    }
    for item in extra:
        if not mapping(item):
            raise CandidateError(Failure.INVALID_RECORD)
        paths.add(text_field(item, "path"))
    return frozenset(paths)


def _validated_pr(repository: str, revision: str, author: str, number: int) -> _ValidatedReleasePr:
    pull = observe(f"repos/{repository}/pulls/{number}")
    if (
        not mapping(pull)
        or not mapping(head := pull.get("head"))
        or not mapping(head_repo := head.get("repo"))
        or not mapping(base := pull.get("base"))
        or not mapping(base_repo := base.get("repo"))
        or not mapping(user := pull.get("user"))
        or not sequence(labels := pull.get("labels"))
    ):
        raise CandidateError(Failure.INVALID_RECORD)
    if (
        pull.get("state") != "open"
        or pull.get("draft") is not False
        or head.get("sha") != revision
        or head.get("ref") != RELEASE_BRANCH
        or head_repo.get("full_name") != repository
        or base.get("ref") != "main"
        or base_repo.get("full_name") != repository
        or user.get("login") != author
        or user.get("type") != "Bot"
        or not any(
            mapping(label) and label.get("name") == "autorelease: pending" for label in labels
        )
    ):
        raise CandidateError(Failure.WRONG_PRODUCER)
    files = observe(f"repos/{repository}/pulls/{number}/files?per_page=100")
    if not sequence(files) or len(files) >= PAGE_SIZE or pull.get("changed_files") != len(files):
        raise CandidateError(Failure.INCOMPLETE_RESPONSE)
    allowed = _release_paths()
    if len(files) != len(allowed) or any(
        not mapping(file) or file.get("status") != "modified" for file in files
    ):
        raise CandidateError(Failure.PAYLOAD_MISMATCH)
    if frozenset(text_field(file, "filename") for file in files if mapping(file)) != allowed:
        raise CandidateError(Failure.PAYLOAD_MISMATCH)
    version = source_version(repository, revision)
    previous = source_version(repository, text_field(base, "sha"))
    current_parts = tuple(int(part) for part in version.split("."))
    previous_parts = tuple(int(part) for part in previous.split("."))
    if current_parts != (previous_parts[0], previous_parts[1], previous_parts[2] + 1):
        raise CandidateError(Failure.INVALID_IDENTITY)
    return _ValidatedReleasePr(number, revision, version)


def admit_pr(repository: str, revision: str, run_id: int, author: str) -> _ValidatedReleasePr:
    require_identity(repository, revision)
    if not positive(run_id) or not re.fullmatch(r"[a-z0-9-]+\[bot\]", author):
        raise CandidateError(Failure.INVALID_IDENTITY)
    producer = successful_run(
        observe(f"repos/{repository}/actions/runs/{run_id}"),
        repository,
        revision,
    )
    if (
        producer.get("id") != run_id
        or producer.get("event") != "pull_request"
        or producer.get("head_branch") != RELEASE_BRANCH
        or not mapping(owner := producer.get("head_repository"))
        or owner.get("full_name") != repository
        or not mapping(actor := producer.get("actor"))
        or actor.get("login") != author
    ):
        raise CandidateError(Failure.WRONG_PRODUCER)
    attempt = number_field(producer, "run_attempt")
    jobs = listing(
        observe(f"repos/{repository}/actions/runs/{run_id}/attempts/{attempt}/jobs?per_page=100"),
        "jobs",
    )
    for name in ("Validate marketplace source", "Retain tested Pi candidate"):
        matches = [job for job in jobs if job.get("name") == name]
        if (
            len(matches) != 1
            or matches[0].get("status") != "completed"
            or matches[0].get("conclusion") != "success"
        ):
            raise CandidateError(Failure.PRODUCER_NOT_SUCCESSFUL)
    pulls = observe(f"repos/{repository}/commits/{revision}/pulls?per_page=100")
    if not sequence(pulls) or len(pulls) >= PAGE_SIZE:
        raise CandidateError(Failure.INCOMPLETE_RESPONSE)
    matches = [
        pull
        for pull in pulls
        if mapping(pull)
        and pull.get("state") == "open"
        and mapping(head := pull.get("head"))
        and head.get("ref") == RELEASE_BRANCH
    ]
    if len(matches) != 1:
        raise CandidateError(Failure.WRONG_PRODUCER)
    return _validated_pr(repository, revision, author, number_field(matches[0], "number"))


def select(repository: str, revision: str, run_id: int) -> Selection:
    if not REPOSITORY.fullmatch(repository) or not positive(run_id):
        raise CandidateError(Failure.INVALID_IDENTITY)
    observed = observe(f"repos/{repository}/actions/runs/{run_id}")
    if not mapping(observed):
        raise CandidateError(Failure.WRONG_PRODUCER)
    selected = revision or text_field(observed, "head_sha")
    require_identity(repository, selected)
    producer = successful_run(observed, repository, selected)
    if producer.get("event") != "push" or producer.get("head_branch") != "main":
        raise CandidateError(Failure.WRONG_PRODUCER)
    commit = observe(f"repos/{repository}/git/commits/{selected}")
    if (
        not mapping(commit)
        or commit.get("sha") != selected
        or not sequence(parents := commit.get("parents"))
        or not parents
        or not mapping(parent := parents[0])
    ):
        raise CandidateError(Failure.INVALID_RECORD)
    version = source_version(repository, selected)
    previous = source_version(repository, text_field(parent, "sha"))
    current_parts = tuple(int(part) for part in version.split("."))
    previous_parts = tuple(int(part) for part in previous.split("."))
    if current_parts < previous_parts:
        raise CandidateError(Failure.INVALID_IDENTITY)
    published = observe(f"repos/{repository}/releases/latest")
    if (
        not mapping(published)
        or published.get("draft") is not False
        or published.get("prerelease") is not False
    ):
        raise CandidateError(Failure.INVALID_RECORD)
    tag = text_field(published, "tag_name")
    published_version = tag.removeprefix("slopsentral-v")
    if not tag.startswith("slopsentral-v") or not VERSION.fullmatch(published_version):
        raise CandidateError(Failure.INVALID_RECORD)
    published_parts = tuple(int(part) for part in published_version.split("."))
    if current_parts < published_parts:
        raise CandidateError(Failure.INVALID_IDENTITY)
    return Selection(selected, version, current_parts > published_parts)


@dataclass(frozen=True, slots=True)
class _PendingVersionPr:
    number: int


def _pending_version_pr(
    repository: str,
    revision: str,
    version: str,
    pull: object,
) -> tuple[_PendingVersionPr, ...]:
    if not mapping(pull) or not sequence(labels := pull.get("labels")):
        raise CandidateError(Failure.INVALID_RECORD)
    if not mapping(pull.get("pull_request")) or not any(
        mapping(label) and label.get("name") == "autorelease: pending" for label in labels
    ):
        return ()
    number = pull.get("number")
    if not positive(number):
        raise CandidateError(Failure.INVALID_RECORD)
    detail = observe(f"repos/{repository}/pulls/{number}")
    if not mapping(detail) or not mapping(base := detail.get("base")):
        raise CandidateError(Failure.INVALID_RECORD)
    if not detail.get("merged_at") or base.get("ref") != "main":
        return ()
    merged = text_field(detail, "merge_commit_sha")
    if source_version(repository, merged) != version:
        return ()
    if merged != revision:
        comparison = observe(f"repos/{repository}/compare/{merged}...{revision}")
        if not mapping(comparison) or comparison.get("status") != "ahead":
            raise CandidateError(Failure.WRONG_PRODUCER)
    return (_PendingVersionPr(number),)


def finalize(repository: str, revision: str) -> None:
    require_identity(repository, revision)
    version = source_version(repository, revision)
    pulls = observe(
        f"repos/{repository}/issues?state=closed&labels=autorelease%3A%20pending&per_page=100"
    )
    if not sequence(pulls) or len(pulls) >= PAGE_SIZE:
        raise CandidateError(Failure.INCOMPLETE_RESPONSE)
    pending = tuple(
        found
        for pull in pulls
        for found in _pending_version_pr(repository, revision, version, pull)
    )
    if not pending:
        return
    release = observe(f"repos/{repository}/releases/tags/slopsentral-v{version}")
    ref = observe(f"repos/{repository}/git/ref/tags/slopsentral-v{version}")
    if (
        not mapping(release)
        or release.get("draft") is not False
        or release.get("prerelease") is not False
        or not mapping(ref)
        or not mapping(target := ref.get("object"))
        or target.get("sha") != revision
        or target.get("type") != "commit"
    ):
        raise CandidateError(Failure.WRONG_PRODUCER)
    _ = run_command(
        [
            "gh",
            "label",
            "create",
            "autorelease: tagged",
            "--repo",
            repository,
            "--description",
            "Release Please release published",
            "--color",
            "ededed",
            "--force",
        ]
    )
    for pull in pending:
        _ = run_command(
            [
                "gh",
                "pr",
                "edit",
                str(pull.number),
                "--repo",
                repository,
                "--remove-label",
                "autorelease: pending",
                "--add-label",
                "autorelease: tagged",
            ]
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("command", choices=("check", "select", "finalize", "admit-pr"))
    _ = parser.add_argument("--root", type=Path, default=ROOT)
    _ = parser.add_argument("--repository", default="amichne/slopsentral")
    _ = parser.add_argument("--revision", default="")
    _ = parser.add_argument("--run-id", type=int, default=0)
    _ = parser.add_argument("--author", default="")
    _ = parser.add_argument("--github-output", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "check":
            result = {"version": check(Path(args.root))}
        elif args.command == "finalize":
            finalize(str(args.repository), str(args.revision))
            result = {"revision": str(args.revision)}
        elif args.command == "admit-pr":
            admitted = admit_pr(
                str(args.repository), str(args.revision), int(args.run_id), str(args.author)
            )
            result = {
                "pull_request": str(admitted.number),
                "revision": admitted.revision,
                "version": admitted.version,
            }
        else:
            selected = select(str(args.repository), str(args.revision), int(args.run_id))
            result = {
                "revision": selected.revision,
                "version": selected.version,
                "release": str(selected.release).lower(),
            }
        if args.github_output is not None:
            with Path(args.github_output).open("a") as output:
                for key, value in result.items():
                    _ = output.write(f"{key}={value}\n")
    except CandidateError as error:
        print(json.dumps({"type": "RELEASE_REJECTED", "reason": error.failure.value}))
        return 1
    except OSError:
        print(json.dumps({"type": "RELEASE_REJECTED", "reason": Failure.EFFECT_FAILED.value}))
        return 1
    except ValueError:
        print(json.dumps({"type": "RELEASE_REJECTED", "reason": Failure.INVALID_RECORD.value}))
        return 1
    print(json.dumps({"type": "RELEASE_VERSION", **result}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
