from __future__ import annotations

import base64
import hashlib
import json
import shutil
import subprocess
import zipfile
from dataclasses import asdict
from pathlib import Path
from typing import TYPE_CHECKING

import pytest

from tools import pi_candidate as candidate
from tools.package_pi import Packed, package
from tools.python_checks.test_package_pi import fixture

if TYPE_CHECKING:
    from collections.abc import Callable

REPOSITORY = "amichne/slopsentral"
SOURCE = "a" * 40
MERGED = "b" * 40
TREE = "c" * 40
OTHER_TREE = "d" * 40


def bundle_at(
    tmp_path: Path, version: str = "0.1.123", schema_version: int = 1
) -> tuple[Path, candidate.Candidate]:
    root = fixture(tmp_path / "package")
    bundle = tmp_path / "bundle"
    packed = package(root, bundle, version=version)
    assert isinstance(packed, Packed)
    record = {
        "schema_version": schema_version,
        "repository": REPOSITORY,
        "source_revision": SOURCE,
        "source_tree": TREE,
        "run_id": 101,
        "run_number": 123,
        "run_attempt": 1,
        "event": "pull_request",
        "version": version,
        "archive": packed.archive.name,
        "sha256": hashlib.sha256(packed.archive.read_bytes()).hexdigest(),
        "size": packed.archive.stat().st_size,
    }
    _ = (bundle / "candidate.json").write_text(json.dumps(record))
    decoded = candidate.decode(record)
    assert isinstance(decoded, candidate.Candidate)
    return bundle, decoded


def producer() -> dict[str, object]:
    return {
        "repository": {"full_name": REPOSITORY},
        "path": ".github/workflows/validate-source.yml",
        "id": 101,
        "run_number": 123,
        "run_attempt": 1,
        "head_sha": SOURCE,
        "event": "pull_request",
        "status": "completed",
        "conclusion": "success",
    }


@pytest.mark.parametrize(
    ("field", "value", "failure"),
    [
        ("repository", {"full_name": "attacker/fork"}, candidate.Failure.WRONG_PRODUCER),
        ("path", ".github/workflows/other.yml", candidate.Failure.WRONG_PRODUCER),
        ("id", 102, candidate.Failure.WRONG_PRODUCER),
        ("run_number", 124, candidate.Failure.WRONG_PRODUCER),
        ("run_attempt", 2, candidate.Failure.WRONG_PRODUCER),
        ("head_sha", MERGED, candidate.Failure.WRONG_PRODUCER),
        ("event", "push", candidate.Failure.WRONG_PRODUCER),
        ("status", "in_progress", candidate.Failure.PRODUCER_NOT_SUCCESSFUL),
        ("conclusion", "failure", candidate.Failure.PRODUCER_NOT_SUCCESSFUL),
    ],
)
def test_admission_rejects_the_nearest_wrong_producer(
    tmp_path: Path, field: str, value: object, failure: candidate.Failure
) -> None:
    _, record = bundle_at(tmp_path)
    assert candidate.admit(record, producer(), REPOSITORY, TREE) == candidate.Admitted(record)
    assert candidate.admit(record, producer() | {field: value}, REPOSITORY, TREE) == failure
    assert (
        candidate.admit(record, producer(), REPOSITORY, OTHER_TREE)
        == candidate.Failure.SOURCE_TREE_MISMATCH
    )


def test_schema_two_carries_a_release_version_independent_of_the_run(tmp_path: Path) -> None:
    bundle, record = bundle_at(tmp_path, "4.0.1", schema_version=2)
    assert record.run_number == 123
    assert candidate.read(bundle).version == "4.0.1"
    assert (
        candidate.decode(asdict(record) | {"schema_version": 1}) == candidate.Failure.INVALID_RECORD
    )
    assert (
        candidate.decode(asdict(record) | {"schema_version": 3}) == candidate.Failure.INVALID_RECORD
    )


def test_promotion_binds_the_declared_source_version(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    bundle, record = bundle_at(tmp_path, "4.0.1", schema_version=2)
    documents = main_responses()
    source: dict[str, object] = {
        "encoding": "base64",
        "content": base64.b64encode(b'{"version":"4.0.1"}').decode(),
    }
    documents[f"repos/{REPOSITORY}/contents/package.json?ref={MERGED}"] = source
    monkeypatch.setattr(candidate, "observe", documents.__getitem__)
    monkeypatch.setattr(candidate, "download", transport(bundle))
    assert candidate.promote(
        REPOSITORY, MERGED, 202, tmp_path / "promoted", tmp_path / "promotion.json"
    ) == candidate.Promoted(record, MERGED)
    source["content"] = base64.b64encode(b'{"version":"4.0.2"}').decode()
    with pytest.raises(candidate.CandidateError, match=candidate.Failure.PAYLOAD_MISMATCH):
        _ = candidate.promote(REPOSITORY, MERGED, 202, tmp_path / "wrong", tmp_path / "wrong.json")


def test_retained_bytes_round_trip_without_tar_extraction(tmp_path: Path) -> None:
    bundle, record = bundle_at(tmp_path)
    artifact = tmp_path / "artifact.zip"
    with zipfile.ZipFile(artifact, "w") as zipped:
        for file in bundle.iterdir():
            zipped.write(file, file.name)
    result = candidate.unpack(artifact, tmp_path / "downloaded")
    assert result == record
    assert (tmp_path / "downloaded" / record.archive).read_bytes() == (
        bundle / record.archive
    ).read_bytes()


@pytest.mark.parametrize("damage", ["archive", "checksum", "version", "symlink", "extra"])
def test_bundle_rejects_tampered_or_ambiguous_payload(tmp_path: Path, damage: str) -> None:
    bundle, record = bundle_at(tmp_path)
    archive = bundle / record.archive
    if damage == "archive":
        _ = archive.write_bytes(archive.read_bytes() + b"changed")
    elif damage == "checksum":
        _ = (bundle / "SHA256SUMS").write_text("wrong digest")
    elif damage == "version":
        fields = asdict(record) | {
            "version": "0.1.124",
            "run_number": 124,
            "archive": "slopsentral-pi-0.1.124.tgz",
        }
        _ = archive.rename(bundle / "slopsentral-pi-0.1.124.tgz")
        _ = (bundle / "candidate.json").write_text(json.dumps(fields))
        _ = (bundle / "SHA256SUMS").write_text(f"{record.sha256}  slopsentral-pi-0.1.124.tgz\n")
    elif damage == "symlink":
        external = tmp_path / "outside"
        _ = archive.rename(external)
        archive.symlink_to(external)
    else:
        _ = (bundle / "extra").write_text("unexpected")
    with pytest.raises(candidate.CandidateError):
        _ = candidate.read(bundle)


@pytest.mark.parametrize("name", ["../escape", "/absolute", "nested/archive.tgz"])
def test_zip_paths_never_escape_the_destination(tmp_path: Path, name: str) -> None:
    bundle, record = bundle_at(tmp_path)
    artifact = tmp_path / "artifact.zip"
    with zipfile.ZipFile(artifact, "w") as zipped:
        zipped.write(bundle / "candidate.json", "candidate.json")
        zipped.write(bundle / "SHA256SUMS", "SHA256SUMS")
        zipped.write(bundle / record.archive, name)
    with pytest.raises(candidate.CandidateError):
        _ = candidate.unpack(artifact, tmp_path / "downloaded")
    assert not (tmp_path / "downloaded").exists()
    assert not (tmp_path / "escape").exists()


def main_responses() -> dict[str, object]:
    return {
        f"repos/{REPOSITORY}/actions/runs/202": producer()
        | {
            "id": 202,
            "run_number": 200,
            "head_sha": MERGED,
            "event": "push",
            "head_branch": "main",
        },
        f"repos/{REPOSITORY}/actions/runs/101": producer(),
        f"repos/{REPOSITORY}/git/commits/{MERGED}": {"sha": MERGED, "tree": {"sha": TREE}},
        f"repos/{REPOSITORY}/git/commits/{SOURCE}": {"sha": SOURCE, "tree": {"sha": TREE}},
    }


def transport(bundle: Path) -> Callable[[str, dict[str, object], str, Path], candidate.Candidate]:
    def download(
        _repository: str, _run: dict[str, object], _revision: str, output: Path
    ) -> candidate.Candidate:
        _ = shutil.copytree(bundle, output)
        return candidate.read(output)

    return download


def test_promotion_keeps_original_bytes_and_records_both_runs(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    bundle, record = bundle_at(tmp_path)
    responses = main_responses()
    monkeypatch.setattr(candidate, "observe", responses.__getitem__)
    monkeypatch.setattr(candidate, "download", transport(bundle))
    destination = tmp_path / "promoted"
    promotion = tmp_path / "promotion.json"
    assert candidate.promote(REPOSITORY, MERGED, 202, destination, promotion) == candidate.Promoted(
        record, MERGED
    )
    assert (destination / record.archive).read_bytes() == (bundle / record.archive).read_bytes()
    evidence = json.loads(promotion.read_bytes())
    assert evidence["source_revision"] == SOURCE
    assert evidence["merged_revision"] == MERGED
    assert evidence["build_run_id"] == 101
    assert evidence["main_run_id"] == 202
    assert (
        evidence["archive_sha256"]
        == hashlib.sha256((bundle / record.archive).read_bytes()).hexdigest()
    )


@pytest.mark.parametrize(
    "rejection", ["failed-main", "wrong-branch", "failed-original", "changed-tree"]
)
def test_promotion_stops_without_a_receipt(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, rejection: str
) -> None:
    bundle, _ = bundle_at(tmp_path)
    responses = main_responses()
    if rejection in {"failed-main", "wrong-branch"}:
        responses[f"repos/{REPOSITORY}/actions/runs/202"] = producer() | {
            "id": 202,
            "head_sha": MERGED,
            "event": "push",
            "head_branch": "topic" if rejection == "wrong-branch" else "main",
            "conclusion": "failure" if rejection == "failed-main" else "success",
        }
    elif rejection == "failed-original":
        responses[f"repos/{REPOSITORY}/actions/runs/101"] = producer() | {"conclusion": "failure"}
    else:
        responses[f"repos/{REPOSITORY}/git/commits/{MERGED}"] = {
            "sha": MERGED,
            "tree": {"sha": OTHER_TREE},
        }
    monkeypatch.setattr(candidate, "observe", responses.__getitem__)
    monkeypatch.setattr(candidate, "download", transport(bundle))
    receipt = tmp_path / "promotion.json"
    with pytest.raises(candidate.CandidateError):
        _ = candidate.promote(REPOSITORY, MERGED, 202, tmp_path / "promoted", receipt)
    assert not receipt.exists()


@pytest.mark.parametrize("same_tree", [True, False])
def test_reuse_needs_a_successful_merged_pr_and_exact_tree(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, *, same_tree: bool
) -> None:
    bundle, record = bundle_at(tmp_path)
    responses = main_responses() | {
        f"repos/{REPOSITORY}/commits/{MERGED}/pulls?per_page=100": [
            {
                "merged_at": "2026-10-16",
                "merge_commit_sha": MERGED,
                "head": {"sha": SOURCE, "repo": {"full_name": REPOSITORY}},
            }
        ],
        f"repos/{REPOSITORY}/actions/workflows/validate-source.yml/runs?head_sha={SOURCE}&event=pull_request&per_page=100": {
            "total_count": 1,
            "workflow_runs": [producer()],
        },
        f"repos/{REPOSITORY}/actions/runs/101/artifacts?per_page=100": {
            "total_count": 1,
            "artifacts": [{"id": 404, "name": f"pi-candidate-{SOURCE}-1", "expired": False}],
        },
    }
    if not same_tree:
        responses[f"repos/{REPOSITORY}/git/commits/{SOURCE}"] = {
            "sha": SOURCE,
            "tree": {"sha": OTHER_TREE},
        }
    monkeypatch.setattr(candidate, "observe", responses.__getitem__)
    monkeypatch.setattr(candidate, "download", transport(bundle))
    destination = tmp_path / "reused"
    result = candidate.reuse(REPOSITORY, MERGED, destination)
    assert result == ("REUSED" if same_tree else "MISSING")
    if same_tree:
        assert (destination / record.archive).read_bytes() == (bundle / record.archive).read_bytes()
    else:
        assert not destination.exists()


def test_incomplete_lists_and_duplicate_record_fields_are_rejected() -> None:
    with pytest.raises(candidate.CandidateError):
        _ = candidate.listing({"total_count": 2, "artifacts": [{"id": 1}]}, "artifacts")
    with pytest.raises(candidate.CandidateError):
        _ = candidate.load(b'{"schema_version":1,"schema_version":1}')


def test_seal_binds_the_actual_clean_git_tree(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    bundle, _ = bundle_at(tmp_path)
    (bundle / "candidate.json").unlink()
    repository = tmp_path / "repository"
    repository.mkdir()

    def git(*arguments: str) -> str:
        return subprocess.run(
            ["git", *arguments], cwd=repository, capture_output=True, text=True, check=True
        ).stdout.strip()

    _ = git("init")
    _ = git("config", "user.email", "fixture@example.invalid")
    _ = git("config", "user.name", "Fixture")
    _ = (repository / "source").write_text("original")
    _ = (repository / "package.json").write_text(
        json.dumps({"name": "slopsentral", "version": "0.1.123"})
    )
    _ = git("add", "source", "package.json")
    _ = git("commit", "-m", "fixture")
    revision = git("rev-parse", "HEAD")
    monkeypatch.chdir(repository)
    result = candidate.seal(REPOSITORY, revision, candidate.Producer(101, 123, 1, "push"), bundle)
    assert result.source_revision == revision
    assert result.schema_version == 2
    assert result.version == "0.1.123"
    assert result.source_tree == git("rev-parse", "HEAD^{tree}")
    _ = (repository / "source").write_text("changed")
    with pytest.raises(candidate.CandidateError, match="INVALID_IDENTITY"):
        _ = candidate.seal(REPOSITORY, revision, candidate.Producer(101, 123, 1, "push"), bundle)


def test_manual_promotion_uses_the_selected_runs_exact_revision(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    bundle, record = bundle_at(tmp_path)
    monkeypatch.setattr(candidate, "observe", main_responses().__getitem__)
    monkeypatch.setattr(candidate, "download", transport(bundle))
    assert candidate.promote(
        REPOSITORY, "", 202, tmp_path / "promoted", tmp_path / "promotion.json"
    ) == candidate.Promoted(record, MERGED)


@pytest.mark.parametrize(
    "extra",
    [
        {"run_attempt": True},
        {"run_number": 0},
        {"source_tree": "0" * 40},
        {"archive": "../archive.tgz"},
        {"sha256": "0" * 63},
        {"unexpected": "field"},
    ],
)
def test_record_parser_returns_a_finite_failure(tmp_path: Path, extra: dict[str, object]) -> None:
    _, record = bundle_at(tmp_path)
    assert candidate.decode(asdict(record) | extra) == candidate.Failure.INVALID_RECORD


@pytest.mark.parametrize("control", ["missing", "expired", "fork", "failed"])
def test_unqualified_pr_candidates_start_a_fresh_main_build(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    control: str,
) -> None:
    responses: dict[str, object] = main_responses() | {
        f"repos/{REPOSITORY}/commits/{MERGED}/pulls?per_page=100": [
            {
                "merged_at": "2026-10-16",
                "merge_commit_sha": MERGED,
                "head": {
                    "sha": SOURCE,
                    "repo": {"full_name": "attacker/fork" if control == "fork" else REPOSITORY},
                },
            }
        ],
        f"repos/{REPOSITORY}/actions/workflows/validate-source.yml/runs?head_sha={SOURCE}&event=pull_request&per_page=100": {
            "total_count": 1,
            "workflow_runs": [
                producer() | {"conclusion": "failure" if control == "failed" else "success"}
            ],
        },
        f"repos/{REPOSITORY}/actions/runs/101/artifacts?per_page=100": {
            "total_count": 0 if control == "missing" else 1,
            "artifacts": []
            if control == "missing"
            else [
                {
                    "id": 404,
                    "name": f"pi-candidate-{SOURCE}-1",
                    "expired": True,
                }
            ],
        },
    }
    monkeypatch.setattr(candidate, "observe", responses.__getitem__)
    calls: list[str] = []

    def no_download(
        _repository: str, _run: dict[str, object], _revision: str, _bundle: Path
    ) -> candidate.Candidate:
        calls.append("download")
        pytest.fail("Unqualified PR candidates must never download")

    monkeypatch.setattr(candidate, "download", no_download)
    destination = tmp_path / "reused"
    assert candidate.reuse(REPOSITORY, MERGED, destination) == "MISSING"
    assert calls == []
    assert not destination.exists()


@pytest.mark.parametrize("name", ["candidate", "promotion"])
def test_public_provenance_schema_accepts_exact_records_and_rejects_extra_fields(name: str) -> None:
    schema = Path(__file__).resolve().parents[2] / f"source/schemas/pi/{name}.schema.json"
    document: object = json.loads(schema.read_bytes())
    assert candidate.mapping(document)
    examples = document["examples"]
    assert candidate.sequence(examples)
    example = examples[0]
    assert candidate.mapping(example)
    payloads = [
        example,
        example | {"unexpected": True},
        example | {"schema_version": True},
        example | {"source_revision": "../foreign"},
    ]
    program = """import fs from 'node:fs'; import Ajv from 'ajv/dist/2020.js';
const schema = JSON.parse(fs.readFileSync(process.argv[1]));
const validate = new Ajv({strict: true}).compile(schema);
const cases = JSON.parse(fs.readFileSync(0));
process.stdout.write(JSON.stringify(cases.map(value => validate(value))));"""
    result = subprocess.run(
        ["node", "--input-type=module", "-e", program, str(schema)],
        input=json.dumps(payloads),
        capture_output=True,
        text=True,
        check=True,
    )
    assert json.loads(result.stdout) == [True, False, False, False]
