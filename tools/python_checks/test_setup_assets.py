from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from tools import setup_assets
from tools.pi_candidate import CandidateError
from tools.python_checks.test_pi_candidate import bundle_at

if TYPE_CHECKING:
    from pathlib import Path


def test_setup_receipt_binds_exact_installer_and_candidate(tmp_path: Path) -> None:
    candidate, _ = bundle_at(tmp_path)
    source = tmp_path / "source"
    tools = source / "tools"
    tools.mkdir(parents=True)
    for name in setup_assets.FILES:
        _ = (tools / name).write_text(f"verified {name}\n")
    output = tmp_path / "setup"
    setup_assets.package(source, candidate, output)
    setup_assets.verify(output, candidate / "candidate.json")
    _ = (output / "setup-pi.mts").write_text("changed bytes")
    with pytest.raises(CandidateError):
        setup_assets.verify(output, candidate / "candidate.json")


def test_setup_refuses_foreign_source_and_indirect_payload(tmp_path: Path) -> None:
    candidate, _ = bundle_at(tmp_path)
    source = tmp_path / "source"
    tools = source / "tools"
    tools.mkdir(parents=True)
    for name in setup_assets.FILES:
        _ = (tools / name).write_text("verified")
    (tools / "setup-pi.mts").unlink()
    (tools / "setup-pi.mts").symlink_to(tools / "install-pi.sh")
    with pytest.raises(CandidateError):
        setup_assets.package(source, candidate, tmp_path / "setup")
