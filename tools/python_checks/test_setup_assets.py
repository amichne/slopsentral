from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

import pytest
from jsonschema import Draft202012Validator

from tools import setup_assets
from tools.pi_candidate import CandidateError
from tools.python_checks.test_pi_candidate import bundle_at

if TYPE_CHECKING:
    from jsonschema.protocols import Validator

SCHEMA = Path(__file__).resolve().parents[2] / "source/schemas/pi/setup.schema.json"


def receipt_validator() -> Validator:
    schema = json.loads(SCHEMA.read_text())
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def test_setup_receipt_binds_exact_installer_and_candidate(tmp_path: Path) -> None:
    candidate, _ = bundle_at(tmp_path)
    source = tmp_path / "source"
    tools = source / "tools"
    tools.mkdir(parents=True)
    for name in setup_assets.FILES:
        owner = (
            source
            if name == "install.sh"
            else source / "source/hooks"
            if name.startswith("kotlin-horizontalization-check")
            else tools
        )
        asset = owner / name
        asset.parent.mkdir(parents=True, exist_ok=True)
        _ = asset.write_text(f"verified {name}\n")
    output = tmp_path / "setup"
    setup_assets.package(source, candidate, output)
    setup_assets.verify(output, candidate / "candidate.json")
    receipt_validator().validate(json.loads((output / "setup.json").read_bytes()))
    _ = (output / "setup-pi.mts").write_text("changed bytes")
    with pytest.raises(CandidateError):
        setup_assets.verify(output, candidate / "candidate.json")


def test_setup_refuses_foreign_source_and_indirect_payload(tmp_path: Path) -> None:
    candidate, _ = bundle_at(tmp_path)
    source = tmp_path / "source"
    tools = source / "tools"
    tools.mkdir(parents=True)
    for name in setup_assets.FILES:
        owner = (
            source
            if name == "install.sh"
            else source / "source/hooks"
            if name.startswith("kotlin-horizontalization-check")
            else tools
        )
        asset = owner / name
        asset.parent.mkdir(parents=True, exist_ok=True)
        _ = asset.write_text("verified")
    (tools / "setup-pi.mts").unlink()
    (tools / "setup-pi.mts").symlink_to(tools / "install-pi.sh")
    with pytest.raises(CandidateError):
        setup_assets.package(source, candidate, tmp_path / "setup")


@pytest.mark.parametrize(
    ("names", "accepted"),
    [
        (("install-pi.sh", "setup-pi.mts"), True),
        (setup_assets.FILES, True),
        (setup_assets.FILES[:-1], False),
        ((*setup_assets.FILES[:-1], "kotlin-horizontalization-check"), False),
        (
            (
                "install-pi.sh",
                "setup-pi.mts",
                "install.sh",
                "slopsentral.py",
                "slopsentral.py.lock",
            ),
            True,
        ),
        (("install-pi.sh", "setup-pi.mts", "install.sh", "slopsentral.py"), False),
        (("install-pi.sh", "install-pi.sh"), False),
        (
            ("install-pi.sh", "setup-pi.mts", "install.sh", "slopsentral.py", "slopsentral.py"),
            False,
        ),
        (("install-pi.sh", "foreign.py"), False),
    ],
)
def test_setup_schema_accepts_only_complete_known_inventories(
    names: tuple[str, ...],
    *,
    accepted: bool,
) -> None:
    value = {
        "schema_version": 2,
        "repository": "amichne/slopsentral",
        "source_revision": "a" * 40,
        "version": "4.0.7",
        "candidate_sha256": "b" * 64,
        "files": [
            {"file": name, "sha256": f"{index:064x}", "size": 1} for index, name in enumerate(names)
        ],
    }
    assert receipt_validator().is_valid(value) is accepted
