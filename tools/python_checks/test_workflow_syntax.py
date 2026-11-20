from __future__ import annotations

from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
FILES = sorted((ROOT / ".github/workflows").glob("*.yml")) + sorted(
    (ROOT / ".github/actions").glob("*/action.yml")
)


@pytest.mark.parametrize("path", FILES, ids=lambda path: str(path.relative_to(ROOT)))
def test_workflow_and_action_files_parse(path: Path) -> None:
    # pull_request_target runs the base branch's copy, so a broken file on main
    # reaches every later pull request without failing the one that introduced it.
    document = yaml.safe_load(path.read_text())
    assert isinstance(document, dict)
    assert ("jobs" in document) or ("runs" in document)
