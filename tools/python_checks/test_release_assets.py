from __future__ import annotations

import json
from typing import TYPE_CHECKING

import pytest

from tools import release_assets
from tools.pi_candidate import CandidateError, Failure
from tools.release_assets import PROVIDERS, inspect, package, unpack

if TYPE_CHECKING:
    from pathlib import Path

REVISION = "a" * 40


def projections(base: Path) -> Path:
    for harness, root in PROVIDERS.items():
        target = base / harness / root
        target.mkdir(parents=True)
        _ = (target / "marketplace.json").write_text('{"name":"slopsentral"}\n')
        script = target / "example/run.py"
        script.parent.mkdir()
        _ = script.write_text("print('KNOWN_PAYLOAD')\n")
        script.chmod(0o755)
    return base


def test_provider_archives_round_trip_exact_files_and_modes(tmp_path: Path) -> None:
    source = projections(tmp_path / "source")
    bundle = tmp_path / "bundle"
    package(source, bundle, REVISION)
    unpack(bundle, tmp_path / "installed", REVISION)
    for root in PROVIDERS.values():
        script = tmp_path / "installed" / root / "example/run.py"
        assert script.read_text() == "print('KNOWN_PAYLOAD')\n"
        assert script.stat().st_mode & 0o777 == 0o755
    with pytest.raises(FileExistsError):
        unpack(bundle, tmp_path / "installed", REVISION)
    second = tmp_path / "second"
    package(source, second, REVISION)
    for path in bundle.iterdir():
        assert path.read_bytes() == (second / path.name).read_bytes()


@pytest.mark.parametrize("damage", ["revision", "payload", "checksums", "extra", "missing"])
def test_reject_unattributable_assets_before_extraction(tmp_path: Path, damage: str) -> None:
    bundle = tmp_path / "bundle"
    package(projections(tmp_path / "source"), bundle, REVISION)
    revision = "b" * 40 if damage == "revision" else REVISION
    if damage == "payload":
        archive = bundle / "slopsentral-codex.tar.gz"
        _ = archive.write_bytes(archive.read_bytes() + b"changed")
    if damage == "checksums":
        _ = (bundle / "SHA256SUMS").write_text("unproven\n")
    if damage == "extra":
        _ = (bundle / "unqualified.tar.gz").write_bytes(b"unqualified")
    if damage == "missing":
        (bundle / "slopsentral-codex.tar.gz").unlink()
    destination = tmp_path / "installed"
    with pytest.raises(CandidateError):
        unpack(bundle, destination, revision)
    assert not destination.exists()


def test_projection_symlinks_never_enter_archives(tmp_path: Path) -> None:
    source = projections(tmp_path / "source")
    (source / "codex/.agents/plugins/escape").symlink_to(tmp_path)
    with pytest.raises(CandidateError, match=Failure.PAYLOAD_MISMATCH):
        package(source, tmp_path / "bundle", REVISION)


def test_manifest_does_not_invent_another_consumer(tmp_path: Path) -> None:
    bundle = tmp_path / "bundle"
    package(projections(tmp_path / "source"), bundle, REVISION)
    manifest = bundle / "release-assets.json"
    value = json.loads(manifest.read_text())
    value["archives"][0]["harness"] = "other"
    _ = manifest.write_text(json.dumps(value))
    with pytest.raises(CandidateError, match=Failure.INVALID_RECORD):
        _ = inspect(bundle, REVISION)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("conclusion", "failure"),
        ("status", "in_progress"),
        ("head_sha", "b" * 40),
        ("head_branch", "topic"),
        ("event", "pull_request"),
        ("path", ".github/workflows/other.yml"),
    ],
)
def test_publication_rejects_unqualified_run(
    monkeypatch: pytest.MonkeyPatch, field: str, value: str
) -> None:
    run: dict[str, object] = {
        "repository": {"full_name": "amichne/slopsentral"},
        "path": ".github/workflows/validate-source.yml",
        "head_sha": REVISION,
        "id": 123,
        "run_attempt": 1,
        "run_number": 10,
        "status": "completed",
        "conclusion": "success",
        "event": "push",
        "head_branch": "main",
    }

    def observed(endpoint: str) -> object:
        if "artifacts" in endpoint:
            return {
                "total_count": 1,
                "artifacts": [{"name": f"marketplace-candidate-{REVISION}-1", "expired": False}],
            }
        return run

    monkeypatch.setattr(release_assets, "observe", observed)
    assert (
        release_assets.admit_run("amichne/slopsentral", 123, REVISION)
        == f"marketplace-candidate-{REVISION}-1"
    )
    run[field] = value
    with pytest.raises(CandidateError):
        _ = release_assets.admit_run("amichne/slopsentral", 123, REVISION)


def test_tag_retry_accepts_only_the_admitted_revision(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[list[str]] = []
    existing = f"{REVISION}\trefs/tags/slopsentral-v0.1.123"

    def command(arguments: list[str]) -> str:
        calls.append(arguments)
        return existing

    monkeypatch.setattr(release_assets, "run_command", command)
    release_assets.ensure_tag("amichne/slopsentral", "slopsentral-v0.1.123", REVISION)
    assert len(calls) == 1
    existing = f"{'b' * 40}\trefs/tags/slopsentral-v0.1.123"
    with pytest.raises(CandidateError, match=Failure.WRONG_PRODUCER):
        release_assets.ensure_tag("amichne/slopsentral", "slopsentral-v0.1.123", REVISION)
    assert len(calls) == 2
    existing = ""
    release_assets.ensure_tag("amichne/slopsentral", "slopsentral-v0.1.123", REVISION)
    assert calls[-1] == [
        "gh",
        "api",
        "--method",
        "POST",
        "repos/amichne/slopsentral/git/refs",
        "-f",
        "ref=refs/tags/slopsentral-v0.1.123",
        "-f",
        f"sha={REVISION}",
    ]


def test_failed_job_retry_reuses_the_successful_provider_attempt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run: dict[str, object] = {
        "repository": {"full_name": "amichne/slopsentral"},
        "path": ".github/workflows/validate-source.yml",
        "head_sha": REVISION,
        "id": 123,
        "run_attempt": 2,
        "run_number": 10,
        "status": "completed",
        "conclusion": "success",
        "event": "push",
        "head_branch": "main",
    }
    artifacts: list[dict[str, object]] = [
        {"name": f"marketplace-candidate-{REVISION}-1", "expired": False},
        {"name": f"marketplace-candidate-{REVISION}-2", "expired": True},
        {"name": f"marketplace-candidate-{REVISION}-3", "expired": False},
        {"name": f"marketplace-candidate-{'b' * 40}-2", "expired": False},
    ]

    def observed(endpoint: str) -> object:
        return (
            {"total_count": len(artifacts), "artifacts": artifacts}
            if "artifacts" in endpoint
            else run
        )

    monkeypatch.setattr(release_assets, "observe", observed)
    assert (
        release_assets.admit_run("amichne/slopsentral", 123, REVISION)
        == f"marketplace-candidate-{REVISION}-1"
    )
    artifacts[0]["expired"] = True
    with pytest.raises(CandidateError, match=Failure.INVALID_RECORD):
        _ = release_assets.admit_run("amichne/slopsentral", 123, REVISION)
