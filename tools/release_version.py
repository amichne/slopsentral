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
import tomllib
from dataclasses import dataclass
from pathlib import Path

from tools.pi_candidate import (
    PAGE_SIZE,
    REPOSITORY,
    VERSION,
    CandidateError,
    Failure,
    load,
    mapping,
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
    return Selection(selected, version, current_parts > previous_parts)


def finalize(repository: str, revision: str) -> None:
    require_identity(repository, revision)
    pulls = observe(f"repos/{repository}/commits/{revision}/pulls?per_page=100")
    if not sequence(pulls) or len(pulls) >= PAGE_SIZE:
        raise CandidateError(Failure.INCOMPLETE_RESPONSE)
    pending: list[int] = []
    for pull in pulls:
        if not mapping(pull) or not sequence(labels := pull.get("labels")):
            raise CandidateError(Failure.INVALID_RECORD)
        if pull.get("merge_commit_sha") != revision or not pull.get("merged_at"):
            continue
        if any(mapping(label) and label.get("name") == "autorelease: pending" for label in labels):
            number = pull.get("number")
            if not positive(number):
                raise CandidateError(Failure.INVALID_RECORD)
            pending.append(number)
    if not pending:
        return
    version = source_version(repository, revision)
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
    for number in pending:
        _ = run_command(
            [
                "gh",
                "pr",
                "edit",
                str(number),
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
    _ = parser.add_argument("command", choices=("check", "select", "finalize"))
    _ = parser.add_argument("--root", type=Path, default=ROOT)
    _ = parser.add_argument("--repository", default="amichne/slopsentral")
    _ = parser.add_argument("--revision", default="")
    _ = parser.add_argument("--run-id", type=int, default=0)
    _ = parser.add_argument("--github-output", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "check":
            result = {"version": check(Path(args.root))}
        elif args.command == "finalize":
            finalize(str(args.repository), str(args.revision))
            result = {"revision": str(args.revision)}
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
