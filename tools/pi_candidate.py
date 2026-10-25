#!/usr/bin/env -S uv run --locked --script
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
"""Admit one tested Pi archive for source-bound, byte-preserving publication."""

from __future__ import annotations

import argparse
import base64
import binascii
import hashlib
import json
import re
import stat
import subprocess
import tarfile
import tempfile
import zipfile
from dataclasses import asdict, dataclass
from enum import StrEnum
from pathlib import Path
from typing import TypeGuard

WORKFLOW = ".github/workflows/validate-source.yml"
SHA = re.compile(r"[0-9a-f]{40}")
DIGEST = re.compile(r"[0-9a-f]{64}")
VERSION = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)")
REPOSITORY = re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")
CURRENT_SCHEMA = 2
MAX_ARCHIVE = 64 * 1024 * 1024
MAX_RECORD = 4096
MAX_CHECKSUMS = 256
MAX_RUN_NUMBER = 2147483647
PAGE_SIZE = 100
MEMBER_COUNT = 3


class Failure(StrEnum):
    INVALID_IDENTITY = "INVALID_IDENTITY"
    INVALID_RECORD = "INVALID_RECORD"
    WRONG_PRODUCER = "WRONG_PRODUCER"
    PRODUCER_NOT_SUCCESSFUL = "PRODUCER_NOT_SUCCESSFUL"
    SOURCE_TREE_MISMATCH = "SOURCE_TREE_MISMATCH"
    PAYLOAD_MISMATCH = "PAYLOAD_MISMATCH"
    INCOMPLETE_RESPONSE = "INCOMPLETE_RESPONSE"
    EFFECT_FAILED = "EFFECT_FAILED"


class CandidateError(Exception):
    def __init__(self, failure: Failure) -> None:
        self.failure = failure
        super().__init__(failure.value)


@dataclass(frozen=True, slots=True)
class Candidate:
    schema_version: int
    repository: str
    source_revision: str
    source_tree: str
    run_id: int
    run_number: int
    run_attempt: int
    event: str
    version: str
    archive: str
    sha256: str
    size: int


@dataclass(frozen=True, slots=True)
class Admitted:
    candidate: Candidate


def mapping(value: object) -> TypeGuard[dict[str, object]]:
    return isinstance(value, dict)


def sequence(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def positive(value: object) -> TypeGuard[int]:
    return type(value) is int and value > 0


def identity(repository: str, revision: str) -> Failure | None:
    if not REPOSITORY.fullmatch(repository) or not SHA.fullmatch(revision) or revision == "0" * 40:
        return Failure.INVALID_IDENTITY
    return None


def require_identity(repository: str, revision: str) -> None:
    failure = identity(repository, revision)
    if failure is not None:
        raise CandidateError(failure)


def text_field(document: dict[str, object], key: str) -> str:
    value = document.get(key)
    if not isinstance(value, str):
        raise CandidateError(Failure.INVALID_RECORD)
    return value


def number_field(document: dict[str, object], key: str) -> int:
    value = document.get(key)
    if not positive(value):
        raise CandidateError(Failure.INVALID_RECORD)
    return value


def decode(value: object) -> Candidate | Failure:
    if not mapping(value) or set(value) != set(Candidate.__dataclass_fields__):
        return Failure.INVALID_RECORD
    schema = value.get("schema_version")
    repository = value.get("repository")
    revision = value.get("source_revision")
    source_tree = value.get("source_tree")
    run_id = value.get("run_id")
    number = value.get("run_number")
    attempt = value.get("run_attempt")
    event = value.get("event")
    version = value.get("version")
    archive = value.get("archive")
    sha256 = value.get("sha256")
    size = value.get("size")
    if (
        not positive(schema)
        or schema not in {1, CURRENT_SCHEMA}
        or not isinstance(repository, str)
        or not isinstance(revision, str)
        or identity(repository, revision) is not None
        or not isinstance(source_tree, str)
        or not SHA.fullmatch(source_tree)
        or source_tree == "0" * 40
        or not positive(run_id)
        or not positive(number)
        or number > MAX_RUN_NUMBER
        or not positive(attempt)
        or not isinstance(event, str)
        or event not in {"pull_request", "push", "workflow_dispatch"}
        or not isinstance(version, str)
        or not VERSION.fullmatch(version)
        or (schema == 1 and version != f"0.1.{number}")
        or not isinstance(archive, str)
        or archive != f"slopsentral-pi-{version}.tgz"
        or not isinstance(sha256, str)
        or not DIGEST.fullmatch(sha256)
        or not positive(size)
        or size > MAX_ARCHIVE
    ):
        return Failure.INVALID_RECORD
    return Candidate(
        schema,
        repository,
        revision,
        source_tree,
        run_id,
        number,
        attempt,
        event,
        version,
        archive,
        sha256,
        size,
    )


def require_record(value: object) -> Candidate:
    result = decode(value)
    if isinstance(result, Failure):
        raise CandidateError(result)
    return result


def admit(candidate: Candidate, run: object, repository: str, tree: str) -> Admitted | Failure:
    if not mapping(run) or not mapping(owner := run.get("repository")):
        return Failure.WRONG_PRODUCER
    if (
        owner.get("full_name") != repository
        or candidate.repository != repository
        or run.get("path") != WORKFLOW
        or not positive(run.get("id"))
        or not positive(run.get("run_number"))
        or not positive(run.get("run_attempt"))
        or run.get("id") != candidate.run_id
        or run.get("run_number") != candidate.run_number
        or run.get("run_attempt") != candidate.run_attempt
        or run.get("head_sha") != candidate.source_revision
        or run.get("event") != candidate.event
    ):
        return Failure.WRONG_PRODUCER
    if run.get("status") != "completed" or run.get("conclusion") != "success":
        return Failure.PRODUCER_NOT_SUCCESSFUL
    if candidate.source_tree != tree:
        return Failure.SOURCE_TREE_MISMATCH
    return Admitted(candidate)


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    value = dict(pairs)
    if len(value) != len(pairs):
        raise CandidateError(Failure.INVALID_RECORD)
    return value


def load(data: bytes) -> object:
    try:
        return json.loads(data, object_pairs_hook=unique_object)
    except (ValueError, UnicodeDecodeError) as error:
        raise CandidateError(Failure.INVALID_RECORD) from error


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read(bundle: Path) -> Candidate:
    record = bundle / "candidate.json"
    if bundle.is_symlink() or not bundle.is_dir() or record.is_symlink():
        raise CandidateError(Failure.INVALID_RECORD)
    if not record.is_file() or record.stat().st_size > MAX_RECORD:
        raise CandidateError(Failure.INVALID_RECORD)
    candidate = require_record(load(record.read_bytes()))
    expected = {"candidate.json", "SHA256SUMS", candidate.archive}
    if {file.name for file in bundle.iterdir()} != expected:
        raise CandidateError(Failure.INVALID_RECORD)
    if any(file.is_symlink() or not file.is_file() for file in bundle.iterdir()):
        raise CandidateError(Failure.INVALID_RECORD)
    archive = bundle / candidate.archive
    checksums = bundle / "SHA256SUMS"
    if (
        archive.stat().st_size != candidate.size
        or digest(archive) != candidate.sha256
        or checksums.stat().st_size > MAX_CHECKSUMS
        or checksums.read_bytes() != f"{candidate.sha256}  {candidate.archive}\n".encode()
    ):
        raise CandidateError(Failure.PAYLOAD_MISMATCH)
    with tarfile.open(archive) as packed:
        member = packed.getmember("package/package.json")
        if not member.isfile() or member.size > MAX_RECORD:
            raise CandidateError(Failure.PAYLOAD_MISMATCH)
        stream = packed.extractfile(member)
        if stream is None:
            raise CandidateError(Failure.PAYLOAD_MISMATCH)
        manifest = load(stream.read())
        if not mapping(manifest) or manifest.get("version") != candidate.version:
            raise CandidateError(Failure.PAYLOAD_MISMATCH)
    return candidate


def run_command(arguments: list[str]) -> str:
    try:
        result = subprocess.run(arguments, check=False, capture_output=True, text=True, timeout=180)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise CandidateError(Failure.EFFECT_FAILED) from error
    if result.returncode:
        raise CandidateError(Failure.EFFECT_FAILED)
    return result.stdout.strip()


def observe(endpoint: str) -> object:
    return load(run_command(["gh", "api", endpoint]).encode())


def listing(value: object, field: str) -> tuple[dict[str, object], ...]:
    if not mapping(value) or not sequence(items := value.get(field)):
        raise CandidateError(Failure.INCOMPLETE_RESPONSE)
    entries: list[dict[str, object]] = []
    for item in items:
        if not mapping(item):
            raise CandidateError(Failure.INCOMPLETE_RESPONSE)
        entries.append(item)
    if type(value.get("total_count")) is not int or value["total_count"] != len(entries):
        raise CandidateError(Failure.INCOMPLETE_RESPONSE)
    return tuple(entries)


def tree(repository: str, revision: str) -> str:
    require_identity(repository, revision)
    value = observe(f"repos/{repository}/git/commits/{revision}")
    if not mapping(value) or value.get("sha") != revision or not mapping(node := value.get("tree")):
        raise CandidateError(Failure.INCOMPLETE_RESPONSE)
    result = text_field(node, "sha")
    require_identity(repository, result)
    return result


def successful_run(value: object, repository: str, revision: str) -> dict[str, object]:
    if (
        not mapping(value)
        or not mapping(owner := value.get("repository"))
        or owner.get("full_name") != repository
        or value.get("path") != WORKFLOW
        or value.get("head_sha") != revision
        or not positive(value.get("id"))
        or not positive(value.get("run_attempt"))
        or not positive(value.get("run_number"))
    ):
        raise CandidateError(Failure.WRONG_PRODUCER)
    if value.get("status") != "completed" or value.get("conclusion") != "success":
        raise CandidateError(Failure.PRODUCER_NOT_SUCCESSFUL)
    return value


def unpack(archive: Path, destination: Path) -> Candidate:
    """Copy admitted flat ZIP members only; never extract or execute a tar payload."""
    if destination.exists() or destination.is_symlink():
        raise CandidateError(Failure.INVALID_RECORD)
    with zipfile.ZipFile(archive) as zipped:
        members = zipped.infolist()
        if (
            len(members) != MEMBER_COUNT
            or len({member.filename for member in members}) != MEMBER_COUNT
        ):
            raise CandidateError(Failure.INVALID_RECORD)
        record = next((member for member in members if member.filename == "candidate.json"), None)
        if record is None or record.file_size > MAX_RECORD:
            raise CandidateError(Failure.INVALID_RECORD)
        candidate = require_record(load(zipped.read(record)))
        limits = {
            "candidate.json": MAX_RECORD,
            "SHA256SUMS": MAX_CHECKSUMS,
            candidate.archive: MAX_ARCHIVE,
        }
        for member in members:
            mode = member.external_attr >> 16
            if (
                member.filename not in limits
                or member.file_size > limits[member.filename]
                or member.is_dir()
                or stat.S_ISLNK(mode)
                or (stat.S_IFMT(mode) not in {0, stat.S_IFREG})
            ):
                raise CandidateError(Failure.INVALID_RECORD)
        destination.mkdir(parents=True)
        for member in members:
            _ = (destination / member.filename).write_bytes(zipped.read(member))
    return read(destination)


def download(
    repository: str, producer: dict[str, object], revision: str, bundle: Path
) -> Candidate:
    name = f"pi-candidate-{revision}-{number_field(producer, 'run_attempt')}"
    run_id = number_field(producer, "id")
    artifacts = listing(
        observe(f"repos/{repository}/actions/runs/{run_id}/artifacts?per_page=100"), "artifacts"
    )
    matches = [
        item for item in artifacts if item.get("name") == name and item.get("expired") is False
    ]
    if len(matches) != 1:
        raise CandidateError(Failure.INVALID_RECORD)
    artifact_id = number_field(matches[0], "id")
    with tempfile.TemporaryDirectory(prefix="pi-candidate-") as temporary:
        archive = Path(temporary) / "artifact.zip"
        try:
            with archive.open("xb") as stream:
                result = subprocess.run(
                    ["gh", "api", f"repos/{repository}/actions/artifacts/{artifact_id}/zip"],
                    stdout=stream,
                    check=False,
                    timeout=180,
                )
        except (OSError, subprocess.TimeoutExpired) as error:
            raise CandidateError(Failure.EFFECT_FAILED) from error
        if result.returncode or archive.stat().st_size > MAX_ARCHIVE + 8192:
            raise CandidateError(Failure.EFFECT_FAILED)
        return unpack(archive, bundle)


def reuse(repository: str, revision: str, bundle: Path) -> str:
    require_identity(repository, revision)
    pulls = observe(f"repos/{repository}/commits/{revision}/pulls?per_page=100")
    if not sequence(pulls) or len(pulls) >= PAGE_SIZE:
        raise CandidateError(Failure.INCOMPLETE_RESPONSE)
    expected_tree = tree(repository, revision)
    for pull in pulls:
        if (
            not mapping(pull)
            or not pull.get("merged_at")
            or pull.get("merge_commit_sha") != revision
            or not mapping(head := pull.get("head"))
            or not mapping(owner := head.get("repo"))
            or owner.get("full_name") != repository
        ):
            continue
        source = text_field(head, "sha")
        if tree(repository, source) != expected_tree:
            continue
        runs = listing(
            observe(
                f"repos/{repository}/actions/workflows/validate-source.yml/runs?head_sha={source}&event=pull_request&per_page=100"
            ),
            "workflow_runs",
        )
        for candidate_run in sorted(runs, key=lambda item: number_field(item, "id"), reverse=True):
            if (
                candidate_run.get("status") != "completed"
                or candidate_run.get("conclusion") != "success"
            ):
                continue
            producer = successful_run(candidate_run, repository, source)
            if producer.get("event") != "pull_request":
                raise CandidateError(Failure.WRONG_PRODUCER)
            artifacts = listing(
                observe(
                    f"repos/{repository}/actions/runs/{number_field(producer, 'id')}/artifacts?per_page=100"
                ),
                "artifacts",
            )
            name = f"pi-candidate-{source}-{number_field(producer, 'run_attempt')}"
            if not any(
                item.get("name") == name and item.get("expired") is False for item in artifacts
            ):
                continue
            candidate = download(repository, producer, source, bundle)
            admitted = admit(candidate, producer, repository, expected_tree)
            if isinstance(admitted, Failure):
                raise CandidateError(admitted)
            return "REUSED"
    return "MISSING"


@dataclass(frozen=True, slots=True)
class Producer:
    run_id: int
    number: int
    attempt: int
    event: str


def seal(repository: str, revision: str, producer: Producer, bundle: Path) -> Candidate:
    require_identity(repository, revision)
    if run_command(["git", "rev-parse", "HEAD"]) != revision or run_command(
        ["git", "status", "--porcelain"]
    ):
        raise CandidateError(Failure.INVALID_IDENTITY)
    manifest = load(Path("package.json").read_bytes())
    if not mapping(manifest):
        raise CandidateError(Failure.INVALID_RECORD)
    version = text_field(manifest, "version")
    archive = bundle / f"slopsentral-pi-{version}.tgz"
    candidate = require_record(
        asdict(
            Candidate(
                CURRENT_SCHEMA,
                repository,
                revision,
                run_command(["git", "rev-parse", "HEAD^{tree}"]),
                producer.run_id,
                producer.number,
                producer.attempt,
                producer.event,
                version,
                archive.name,
                digest(archive),
                archive.stat().st_size,
            )
        )
    )
    with (bundle / "candidate.json").open("x") as record:
        _ = record.write(json.dumps(asdict(candidate), indent=2) + "\n")
    return read(bundle)


@dataclass(frozen=True, slots=True)
class Promoted:
    candidate: Candidate
    merged_revision: str


def promote(repository: str, revision: str, run_id: int, bundle: Path, record: Path) -> Promoted:
    if not positive(run_id) or not REPOSITORY.fullmatch(repository):
        raise CandidateError(Failure.INVALID_IDENTITY)
    observed = observe(f"repos/{repository}/actions/runs/{run_id}")
    if not mapping(observed):
        raise CandidateError(Failure.WRONG_PRODUCER)
    selected = revision if revision else text_field(observed, "head_sha")
    require_identity(repository, selected)
    revision = selected
    producer = successful_run(observed, repository, revision)
    if producer.get("event") != "push" or producer.get("head_branch") != "main":
        raise CandidateError(Failure.WRONG_PRODUCER)
    candidate = download(repository, producer, revision, bundle)
    original = observe(f"repos/{repository}/actions/runs/{candidate.run_id}")
    expected_tree = tree(repository, revision)
    admitted = admit(candidate, original, repository, expected_tree)
    if isinstance(admitted, Failure):
        raise CandidateError(admitted)
    if tree(repository, candidate.source_revision) != expected_tree:
        raise CandidateError(Failure.SOURCE_TREE_MISMATCH)
    if (
        candidate.schema_version == CURRENT_SCHEMA
        and source_version(repository, revision) != candidate.version
    ):
        raise CandidateError(Failure.PAYLOAD_MISMATCH)
    promotion = {
        "schema_version": candidate.schema_version,
        "repository": repository,
        "source_revision": candidate.source_revision,
        "merged_revision": revision,
        "source_tree": expected_tree,
        "version": candidate.version,
        "build_run_id": candidate.run_id,
        "build_run_attempt": candidate.run_attempt,
        "main_run_id": run_id,
        "main_run_attempt": number_field(producer, "run_attempt"),
        "candidate_sha256": digest(bundle / "candidate.json"),
        "archive_sha256": candidate.sha256,
    }
    record.parent.mkdir(parents=True, exist_ok=True)
    with record.open("x") as stream:
        _ = stream.write(json.dumps(promotion, indent=2) + "\n")
    return Promoted(admitted.candidate, revision)


def source_version(repository: str, revision: str) -> str:
    require_identity(repository, revision)
    # GitHub binds this content to the exact admitted commit, never a mutable branch.
    document = observe(f"repos/{repository}/contents/package.json?ref={revision}")
    if not mapping(document) or document.get("encoding") != "base64":
        raise CandidateError(Failure.INVALID_RECORD)
    encoded = text_field(document, "content")
    if len(encoded) > 64 * 1024:
        raise CandidateError(Failure.INVALID_RECORD)
    try:
        manifest = load(base64.b64decode(encoded.replace("\n", ""), validate=True))
    except binascii.Error as error:
        raise CandidateError(Failure.INVALID_RECORD) from error
    if not mapping(manifest):
        raise CandidateError(Failure.INVALID_RECORD)
    version = text_field(manifest, "version")
    if not VERSION.fullmatch(version):
        raise CandidateError(Failure.INVALID_RECORD)
    return version


def candidate_outputs(candidate: Candidate, bundle: Path) -> dict[str, str]:
    return {
        "version": candidate.version,
        "archive": str(bundle / candidate.archive),
        "source_revision": candidate.source_revision,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("action", choices=("seal", "reuse", "promote"))
    _ = parser.add_argument("--repository", required=True)
    _ = parser.add_argument("--revision", required=True)
    _ = parser.add_argument("--bundle", required=True, type=Path)
    _ = parser.add_argument("--run-id", type=int, default=0)
    _ = parser.add_argument("--run-number", type=int, default=0)
    _ = parser.add_argument("--run-attempt", type=int, default=0)
    _ = parser.add_argument("--event", default="")
    _ = parser.add_argument("--promotion-record", type=Path)
    _ = parser.add_argument("--github-output", type=Path)
    args = parser.parse_args()
    action: str = args.action
    repository: str = args.repository
    revision: str = args.revision
    bundle: Path = args.bundle
    run_id: int = args.run_id
    number: int = args.run_number
    attempt: int = args.run_attempt
    event: str = args.event
    record: Path | None = args.promotion_record
    output: Path | None = args.github_output
    try:
        if action == "reuse":
            values = {"candidate": reuse(repository, revision, bundle)}
        elif action == "seal":
            candidate = seal(repository, revision, Producer(run_id, number, attempt, event), bundle)
            values = candidate_outputs(candidate, bundle)
        elif record is not None:
            promoted = promote(repository, revision, run_id, bundle, record)
            values = candidate_outputs(promoted.candidate, bundle) | {
                "merged_revision": promoted.merged_revision
            }
        else:
            print(json.dumps({"type": "REJECTED", "code": Failure.INVALID_IDENTITY.value}))
            return 1
        if output is not None:
            if any("\n" in value or "\r" in value for value in values.values()):
                print(json.dumps({"type": "REJECTED", "code": Failure.INVALID_IDENTITY.value}))
                return 1
            with output.open("a") as stream:
                for key, value in values.items():
                    _ = stream.write(f"{key}={value}\n")
        print(json.dumps({"type": "ADMITTED", **values}))
    except CandidateError as error:
        print(json.dumps({"type": "REJECTED", "code": error.failure.value}))
        return 1
    except (OSError, zipfile.BadZipFile, tarfile.TarError, KeyError, RuntimeError):
        print(json.dumps({"type": "REJECTED", "code": Failure.EFFECT_FAILED.value}))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
