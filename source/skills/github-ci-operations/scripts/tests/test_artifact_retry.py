import json
import subprocess
import sys
from pathlib import Path

import pytest

SKILL = Path(__file__).resolve().parents[2]
FIXTURES = SKILL / "assets/kast-retry"


def invoke(*args: str | Path) -> tuple[int, object]:
    result = subprocess.run(
        [sys.executable, SKILL / "scripts/artifact_retry.py", *args],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode, json.loads(result.stdout)


def test_failed_consumer_only_retry() -> None:
    assert invoke("edge", FIXTURES / "workflow.yml", "native", "assembly") == (
        1,
        {"sameAttempt": "MATCH", "consumerRetry": "SELECTOR_MISMATCH"},
    )


def test_producer_bound_retry() -> None:
    assert invoke("edge", FIXTURES / "producer-bound.yml", "native", "assembly") == (
        0,
        {"sameAttempt": "MATCH", "consumerRetry": "MATCH"},
    )


@pytest.mark.parametrize(
    ("old", "new"),
    [
        ("needs: native", "needs: other"),
        ("steps.archive.outputs.artifact-id", "steps.reports.outputs.artifact-id"),
        ("needs.native.outputs.executable", "matrix.target"),
    ],
)
def test_unresolved_edge(tmp_path: Path, old: str, new: str) -> None:
    workflow = tmp_path / "workflow.yml"
    _ = workflow.write_text((FIXTURES / "producer-bound.yml").read_text().replace(old, new))
    assert invoke("edge", workflow, "native", "assembly") == (1, {"outcome": "UNRESOLVED"})


@pytest.mark.parametrize(
    "case",
    [
        (17, False, "a", b"abc", "BYTES_MATCH"),
        (18, False, "a", b"abc", "WRONG_ARTIFACT"),
        (17, True, "a", b"abc", "EXPIRED"),
        (17, False, "b", b"abc", "FOREIGN_TREE"),
        (17, False, "a", b"abd", "DIGEST_MISMATCH"),
    ],
)
def test_payload_evidence(
    tmp_path: Path,
    case: tuple[int, bool, str, bytes, str],
) -> None:
    artifact_id, expired, producer_tree, content, expected = case
    archive, metadata = tmp_path / "archive", tmp_path / "response.json"
    _ = archive.write_bytes(content)
    _ = metadata.write_text(
        json.dumps(
            {
                "id": 17,
                "expired": expired,
                "digest": "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            }
        )
    )
    assert invoke("bytes", metadata, str(artifact_id), "a" * 40, producer_tree * 40, archive) == (
        int(expected != "BYTES_MATCH"),
        {"outcome": expected},
    )
