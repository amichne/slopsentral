"""Executable checks for the JSON glossary grammar and its real consumer."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from glossary_json import (
    Canonical,
    FailureCode,
    Rejected,
    in_scope,
    load_glossary,
    occurrences,
    render_markdown,
    vale_rules,
)

SCRIPT = Path(__file__).resolve().parents[1] / "check_glossary.py"
ROOT = SCRIPT.parents[4]


def test_json_glossary_reaches_the_existing_entry_point() -> None:
    result = subprocess.run(
        [sys.executable, str(SCRIPT), str(ROOT / "docs/glossary.json")],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def fixture_payload() -> dict[str, object]:
    data: dict[str, object] = json.loads((ROOT / "docs/glossary.json").read_text())
    entries: list[dict[str, object]] = json.loads(json.dumps(data["entries"]))
    data["entries"] = [entry for entry in entries if entry["id"] in {"skill", "plugin"}]
    data["scope"] = {"root": ".", "include": ["**/*.md"], "exclude": ["excluded.md"]}
    return data


def fixture_entries(data: dict[str, object]) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = json.loads(json.dumps(data["entries"]))
    data["entries"] = entries
    return entries


def write_fixture(tmp_path: Path, data: dict[str, object]) -> Path:
    path = tmp_path / "glossary.json"
    _ = path.write_text(json.dumps(data))
    return path


def rejected_form(action: str, form: str) -> dict[str, object]:
    return {
        "type": action,
        "form": form,
        "reason": "A fixture proves lexical handling, not semantic equivalence.",
        "evidence": [
            {"type": "JUSTIFICATION", "text": "Synthetic scope evidence for this executable check."}
        ],
    }


def test_repository_entries_remain_provisional_without_invented_aliases() -> None:
    result = load_glossary(ROOT / "docs/glossary.json")
    assert not isinstance(result, Rejected)
    assert len(result.entries) == 8
    assert all(
        entry.usage and entry.local_sources and not entry.rejected_forms for entry in result.entries
    )
    assert result.entries[0].term == "agent profile"


@pytest.mark.parametrize(
    "damage",
    [
        "extra",
        "missing",
        "boolean",
        "type",
        "empty-source",
        "invalid-date",
        "empty-reason",
        "unknown-form",
    ],
)
def test_schema_rejects_incomplete_or_unknown_shape(tmp_path: Path, damage: str) -> None:
    data = fixture_payload()
    entry = fixture_entries(data)[0]
    if damage == "extra":
        data["server"] = "https://example.com"
    elif damage == "missing":
        del entry["definition"]
    elif damage == "boolean":
        data["schemaVersion"] = True
    elif damage == "type":
        data["type"] = "FREEFORM"
    elif damage == "empty-source":
        entry["usage"] = []
    elif damage == "invalid-date":
        usages: list[dict[str, object]] = json.loads(json.dumps(entry["usage"]))
        usages[0]["examined"] = "2026-99-99"
        entry["usage"] = usages
    else:
        form = rejected_form("REPLACE", "skilll")
        if damage == "empty-reason":
            form["reason"] = ""
        else:
            form["type"] = "AUTOFIX"
        entry["rejectedForms"] = [form]
    result = load_glossary(write_fixture(tmp_path, data))
    assert isinstance(result, Rejected)
    assert result.code == FailureCode.GRAMMAR


@pytest.mark.parametrize(
    "damage", ["id", "canonical", "form", "chain", "definition", "reference", "scope"]
)
def test_semantic_rejection_keeps_distinct_concepts_distinct(tmp_path: Path, damage: str) -> None:
    data = fixture_payload()
    entries = fixture_entries(data)
    first, second = entries
    expected = FailureCode.COLLISION
    if damage == "id":
        second["id"] = first["id"]
    elif damage == "canonical":
        second["term"] = str(first["term"]).upper()
    elif damage == "form":
        first["rejectedForms"] = [
            rejected_form("REPLACE", "skilll"),
            rejected_form("REVIEW", "SKILLL"),
        ]
    elif damage == "chain":
        first["rejectedForms"] = [rejected_form("REPLACE", str(second["term"]))]
    elif damage == "definition":
        second["definition"] = first["definition"]
    elif damage == "reference":
        first["related"] = ["missing-concept"]
        expected = FailureCode.REFERENCE
    else:
        data["scope"] = {"root": ".", "include": ["../*.md"], "exclude": []}
        expected = FailureCode.SCOPE
    result = load_glossary(write_fixture(tmp_path, data))
    assert isinstance(result, Rejected)
    assert result.code == expected


@pytest.mark.parametrize(
    "text",
    [
        '{"type":"GLOSSARY","type":"GLOSSARY"}',
        '{"schemaVersion":NaN}',
        '{"schemaVersion":Infinity}',
    ],
)
def test_ambiguous_json_is_rejected(tmp_path: Path, text: str) -> None:
    path = tmp_path / "glossary.json"
    _ = path.write_text(text)
    result = load_glossary(path)
    assert isinstance(result, Rejected)
    assert result.code == FailureCode.SYNTAX


def test_literal_occurrences_keep_locations_and_code_exclusions(tmp_path: Path) -> None:
    data = fixture_payload()
    entry = fixture_entries(data)[0]
    entry["rejectedForms"] = [
        rejected_form("REPLACE", "skill.v2"),
        rejected_form("REVIEW", "profile"),
    ]
    result = load_glossary(write_fixture(tmp_path, data))
    assert not isinstance(result, Rejected)
    text = "---\ntitle: skill.v2\n---\nUse the skill.v2 and profile.\n`skill.v2`\n~~~text\nskill.v2\n~~~\n[skill](https://example.com/skill.v2)\nskillXv2 skills\n"
    hits = occurrences(result, text, tmp_path / "guide.md")
    assert [(hit.line, hit.start) for hit in hits] == [(4, 9), (4, 22), (9, 2)]
    assert isinstance(hits[-1].form, Canonical)
    rules = dict(vale_rules(result))
    assert "skill\\\\.v2" in rules["Terminology.yml"]
    assert "action:" not in rules["TerminologyReview.yml"]
    assert "swap:" not in rules["TerminologyReview.yml"]
    assert in_scope(result, tmp_path / "guide.md", tmp_path)
    assert in_scope(result, tmp_path / "nested/guide.md", tmp_path)
    assert not in_scope(result, tmp_path / "excluded.md", tmp_path)
    assert not in_scope(result, tmp_path.parent / "other.md", tmp_path)


def test_plain_text_does_not_use_markdown_exclusions(tmp_path: Path) -> None:
    data = fixture_payload()
    entry = fixture_entries(data)[0]
    entry["rejectedForms"] = [rejected_form("REPLACE", "pluggin")]
    glossary = load_glossary(write_fixture(tmp_path, data))
    assert not isinstance(glossary, Rejected)
    hits = occurrences(glossary, "`pluggin`\n    pluggin\n", tmp_path / "guide.txt")
    assert [hit.line for hit in hits] == [1, 2]


def test_generated_view_drift_is_rejected(tmp_path: Path) -> None:
    data = fixture_payload()
    glossary = write_fixture(tmp_path, data)
    result = load_glossary(glossary)
    assert not isinstance(result, Rejected)
    rendered = tmp_path / "GLOSSARY.md"
    _ = rendered.write_text(render_markdown(result))
    command = [sys.executable, str(SCRIPT), str(glossary), "--check-render", str(rendered)]
    assert subprocess.run(command, capture_output=True, check=False).returncode == 0
    _ = rendered.write_text("Edited by hand.\n")
    changed = subprocess.run(command, capture_output=True, text=True, check=False)
    assert changed.returncode == 2
    assert json.loads(changed.stdout)["code"] == "STALE_VIEW"


def test_real_assessment_uses_json_rules_and_preserves_scope(tmp_path: Path) -> None:
    binary = os.environ.get("VALE_BIN")
    assert binary is not None, "Set VALE_BIN to pinned Vale 3.24.0 for the real consumer check."
    data = fixture_payload()
    entry = fixture_entries(data)[0]
    entry["rejectedForms"] = [
        rejected_form("REPLACE", "pluggin"),
        rejected_form("REVIEW", "profile"),
    ]
    glossary = write_fixture(tmp_path, data)
    document = tmp_path / "guide.md"
    excluded = tmp_path / "excluded.md"
    _ = document.write_text("Use the pluggin and profile.\n")
    _ = excluded.write_text("Use the pluggin.\n")
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT.parent / "assess_text.py"),
            "--vale-bin",
            binary,
            "--glossary",
            str(glossary),
            str(document),
            str(excluded),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    report = json.loads(result.stdout)
    assert result.returncode == 1, report
    assert report["type"] == "ASSESSED"
    first, second = report["documents"]
    assert {finding["rule"] for finding in first["findings"]} == {
        "Slopsentral.Terminology",
        "Slopsentral.TerminologyReview",
    }
    assert first["terminology"]["type"] == "IN_SCOPE"
    assert not second["findings"]
    assert second["terminology"]["type"] == "OUT_OF_SCOPE"
    assert report["comprehension"]["type"] == "NOT_ASSESSED"


def test_citation_urls_never_reach_a_network_adapter(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import socket

    def forbidden(*args: object, **kwargs: object) -> object:
        pytest.fail("Glossary parsing opened a socket for a citation.")

    monkeypatch.setattr(socket, "socket", forbidden)
    result = load_glossary(write_fixture(tmp_path, fixture_payload()))
    assert not isinstance(result, Rejected)
    assert render_markdown(result)


@pytest.mark.parametrize("target", ["source", "missing", "unsupported"])
def test_invalid_outputs_and_documents_fail_before_mutation(tmp_path: Path, target: str) -> None:
    glossary = write_fixture(tmp_path, fixture_payload())
    original = glossary.read_bytes()
    arguments = [sys.executable, str(SCRIPT), str(glossary)]
    if target == "source":
        arguments.extend(["--render", str(glossary)])
    elif target == "missing":
        arguments.append(str(tmp_path.parent / "missing.md"))
    else:
        document = tmp_path / "code.py"
        _ = document.write_text("plugin\n")
        arguments.append(str(document))
    result = subprocess.run(arguments, capture_output=True, text=True, check=False)
    assert result.returncode == 2
    assert json.loads(result.stdout)["code"] == "INPUT"
    assert glossary.read_bytes() == original
