from __future__ import annotations

import json
import tarfile
from typing import TYPE_CHECKING

import pytest

from tools import release_assets
from tools.pi_candidate import CandidateError, Failure

if TYPE_CHECKING:
    from pathlib import Path

REVISION = "a" * 40
VERSION = "4.0.1"


def projections(tmp_path: Path) -> Path:
    for harness, root in release_assets.PROVIDERS.items():
        directory = tmp_path / harness / root
        directory.mkdir(parents=True)
        _ = (directory / "marketplace.json").write_text("{}\n")
        manifest = (
            directory
            / "example"
            / (
                ".codex-plugin/plugin.json"
                if harness == "codex"
                else "plugin.json"
                if harness == "github-copilot"
                else "package.json"
            )
        )
        manifest.parent.mkdir(parents=True)
        _ = manifest.write_text(json.dumps({"version": VERSION}))
        executable = directory / "example/script"
        _ = executable.write_text("fixture")
        executable.chmod(0o755)
    return tmp_path


def test_all_providers_are_packaged_at_one_version_with_stable_bytes_and_modes(
    tmp_path: Path,
) -> None:
    source = projections(tmp_path / "input")
    first, second = tmp_path / "first", tmp_path / "second"
    release_assets.package(source, first, REVISION, VERSION)
    release_assets.package(source, second, REVISION, VERSION)
    archives = release_assets.inspect(first, REVISION, VERSION)
    assert {archive.name for archive in archives} == {
        f"slopsentral-{name}.tar.gz" for name in release_assets.PROVIDERS
    }
    for file in first.iterdir():
        assert file.read_bytes() == (second / file.name).read_bytes()
    for archive, root in zip(archives, release_assets.PROVIDERS.values(), strict=True):
        with tarfile.open(archive) as packed:
            assert packed.getmember(f"{root}/example/script").mode == 0o755
    with pytest.raises(CandidateError, match=Failure.INVALID_RECORD):
        _ = release_assets.inspect(first, REVISION, "4.0.2")
    with pytest.raises(CandidateError, match=Failure.INVALID_RECORD):
        _ = release_assets.inspect(first, "b" * 40, VERSION)


@pytest.mark.parametrize("harness", list(release_assets.PROVIDERS))
def test_mixed_payload_versions_are_not_a_shared_release(tmp_path: Path, harness: str) -> None:
    source = projections(tmp_path / "input")
    directory = source / harness / release_assets.PROVIDERS[harness] / "example"
    manifest = next(directory.rglob("*.json"))
    _ = manifest.write_text(json.dumps({"version": "3.1.0"}))
    with pytest.raises(CandidateError, match=Failure.PAYLOAD_MISMATCH):
        release_assets.package(source, tmp_path / "bundle", REVISION, VERSION)


def test_changed_or_indirect_archives_are_not_publishable(tmp_path: Path) -> None:
    source = projections(tmp_path / "input")
    bundle = tmp_path / "bundle"
    release_assets.package(source, bundle, REVISION, VERSION)
    archive = bundle / "slopsentral-amp.tar.gz"
    original = archive.read_bytes()
    _ = archive.write_bytes(original + b"changed")
    with pytest.raises(CandidateError, match=Failure.PAYLOAD_MISMATCH):
        _ = release_assets.inspect(bundle, REVISION, VERSION)
    _ = archive.write_bytes(original)
    other = tmp_path / "external.tgz"
    _ = archive.rename(other)
    archive.symlink_to(other)
    with pytest.raises(CandidateError, match=Failure.PAYLOAD_MISMATCH):
        _ = release_assets.inspect(bundle, REVISION, VERSION)


def test_retry_admits_the_successful_provider_attempt_not_a_future_or_expired_one(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run: dict[str, object] = {
        "repository": {"full_name": "amichne/slopsentral"},
        "path": ".github/workflows/validate-source.yml",
        "head_sha": REVISION,
        "id": 123,
        "run_attempt": 2,
        "run_number": 999,
        "status": "completed",
        "conclusion": "success",
        "event": "push",
        "head_branch": "main",
    }
    artifacts: list[dict[str, object]] = [
        {"name": f"marketplace-candidate-{REVISION}-1", "expired": False},
        {"name": f"marketplace-candidate-{REVISION}-2", "expired": True},
        {"name": f"marketplace-candidate-{REVISION}-3", "expired": False},
    ]

    def observe(endpoint: str) -> object:
        return (
            {"total_count": len(artifacts), "artifacts": artifacts}
            if "artifacts" in endpoint
            else run
        )

    monkeypatch.setattr(release_assets, "observe", observe)
    assert (
        release_assets.admit_run("amichne/slopsentral", 123, REVISION)
        == f"marketplace-candidate-{REVISION}-1"
    )
    artifacts[0]["expired"] = True
    with pytest.raises(CandidateError, match=Failure.INVALID_RECORD):
        _ = release_assets.admit_run("amichne/slopsentral", 123, REVISION)
