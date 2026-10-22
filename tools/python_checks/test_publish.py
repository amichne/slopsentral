from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from tools.publish import Destination, Failure, FailureCode, Publication, inspect, parse

if TYPE_CHECKING:
    from pathlib import Path


@pytest.mark.parametrize(
    "arguments",
    [
        ["harness", ".", "main", "main", "0" * 40],
        ["harness", ".", "harness/codex", "main", "bad-sha"],
        ["harness", ".", "harness/codex", "main", "0" * 40, "--upload-pack=evil"],
        ["main", ".", "A" * 40],
    ],
)
def test_invalid_publication_has_no_effect_plan(arguments: list[str]) -> None:
    outcome = parse(arguments)
    assert isinstance(outcome, Failure)
    assert outcome.code is FailureCode.INPUT


@pytest.mark.parametrize(
    ("destination", "root"),
    [(Destination.CODEX, ".agents/plugins"), (Destination.AMP, ".amp/plugins")],
)
def test_valid_projection_retains_source_identity(
    tmp_path: Path, destination: Destination, root: str
) -> None:
    provider = tmp_path / root
    provider.mkdir(parents=True)
    _ = (provider / "marketplace.json").write_text("{}")
    parsed = parse(["harness", str(tmp_path), destination.value, "main", "a" * 40])
    assert isinstance(parsed, Publication)
    assert parsed.target is destination
    assert inspect(parsed) is parsed
    _ = (tmp_path / "source.txt").write_text("authored source must not publish")
    assert isinstance(inspect(parsed), Failure)


def test_symlink_projection_is_rejected(tmp_path: Path) -> None:
    real = tmp_path / "real"
    real.mkdir()
    indirect = tmp_path / "indirect"
    indirect.symlink_to(real, target_is_directory=True)
    parsed = parse(["main", str(indirect), "a" * 40])
    assert isinstance(parsed, Publication)
    assert isinstance(inspect(parsed), Failure)
