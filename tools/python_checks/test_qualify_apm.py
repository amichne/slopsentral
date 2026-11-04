from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from jsonschema.protocols import Validator

import pytest
from jsonschema import Draft202012Validator, FormatChecker

from tools import qualify_apm
from tools.qualify_apm import (
    DEFAULT_COMPATIBILITY,
    PLUGINS,
    Compatibility,
    Programs,
    QualificationError,
    Trial,
    compatibility_at,
    context_response,
    failure_response,
    inventory,
    propose_pins,
    qualify,
    upstream_refusal,
    write_new_json,
)


def test_zero_exit_json_failure_cannot_establish_context() -> None:
    refused = json.dumps({"continue": False, "stopReason": "INVALID_PLUGIN_ROOT"})
    failure_response(refused, "INVALID_PLUGIN_ROOT")
    with pytest.raises(QualificationError):
        context_response(refused, "expected bundled policy")
    with pytest.raises(QualificationError):
        failure_response('{"continue": true}', "INVALID_PLUGIN_ROOT")


def test_context_requires_exact_policy_and_event() -> None:
    value = {"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "policy"}}
    context_response(json.dumps(value), "policy")
    with pytest.raises(QualificationError):
        context_response(json.dumps(value), "another policy")
    value["hookSpecificOutput"]["hookEventName"] = "Stop"
    with pytest.raises(QualificationError):
        context_response(json.dumps(value), "policy")


def test_inventory_includes_locks_bytes_modes_and_rejects_symlinks(tmp_path: Path) -> None:
    payload = tmp_path / "hook.py.lock"
    _ = payload.write_text("original")
    payload.chmod(0o644)
    first = inventory(tmp_path)
    payload.chmod(0o755)
    assert inventory(tmp_path) != first
    payload.chmod(0o644)
    _ = payload.write_text("edited")
    assert inventory(tmp_path) != first
    (tmp_path / "indirect").symlink_to(payload)
    with pytest.raises(QualificationError):
        _ = inventory(tmp_path)


def test_trial_does_not_inherit_credentials_or_user_configuration(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("GITHUB_TOKEN", "must-not-propagate")
    monkeypatch.setenv("CODEX_HOME", "/foreign")
    programs = Programs(*(Path("/bin/echo") for _ in range(4)))
    trial = Trial.create(tmp_path / "owned home", programs)
    assert "GITHUB_TOKEN" not in trial.environment
    assert trial.environment["CODEX_HOME"] == str(trial.root / "home/.codex")
    assert trial.environment["GIT_ALLOW_PROTOCOL"] == "file"
    assert trial.environment["UV_PYTHON_DOWNLOADS"] == "never"
    with pytest.raises(FileExistsError):
        _ = Trial.create(trial.root, programs)


def test_copied_script_and_lock_run_without_checkout_imports(tmp_path: Path) -> None:
    source = Path(__file__).resolve().parents[1] / "qualify_apm.py"
    copied = tmp_path / "portable tool; literal.py"
    _ = shutil.copyfile(source, copied)
    _ = shutil.copyfile(source.with_suffix(".py.lock"), copied.with_suffix(".py.lock"))
    result = subprocess.run(
        [sys.executable, str(copied), "--self-test"],
        cwd=tmp_path,
        text=True,
        capture_output=True,
        check=False,
        timeout=10,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {"status": "SELF_TEST_PASS"}


def test_existing_output_is_preserved_before_external_processes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("tools.qualify_apm.platform.system", lambda: "Darwin")
    monkeypatch.setattr("tools.qualify_apm.platform.machine", lambda: "arm64")
    output = tmp_path / "foreign"
    output.mkdir()
    sentinel = output / "keep"
    _ = sentinel.write_bytes(b"foreign")
    programs = Programs(*(tmp_path / "absent" for _ in range(4)))
    with pytest.raises(QualificationError, match="fresh path"):
        _ = qualify(tmp_path / "source", output, programs)
    assert sentinel.read_bytes() == b"foreign"


def test_cli_exposes_central_compatibility_without_runtime_effects(tmp_path: Path) -> None:
    script = Path(__file__).resolve().parents[1] / "qualify_apm.py"
    result = subprocess.run(
        [sys.executable, str(script), "--show-compatibility"],
        cwd=tmp_path,
        text=True,
        capture_output=True,
        check=False,
        timeout=10,
    )
    assert result.returncode == 0, result.stderr
    report = json.loads(result.stdout)
    assert report["qualified"]["codex"] == "0.163.0"
    assert report["latestObserved"]["codex"] == "0.166.0"
    assert not list(tmp_path.iterdir())


def compatibility_validator() -> Validator:
    root = Path(__file__).resolve().parents[2]
    schema = json.loads((root / "source/schemas/apm/compatibility.schema.json").read_text())
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FormatChecker())


def test_record_is_closed_and_matches_owning_schema() -> None:
    root = Path(__file__).resolve().parents[2]
    value = json.loads((root / "tools/apm-compatibility.json").read_text())
    validator = compatibility_validator()
    validator.validate(value)
    assert Compatibility.parse(value).data() == value
    value["qualified"]["codex"] = ">=0.163.0"
    assert list(validator.iter_errors(value))
    with pytest.raises(QualificationError):
        _ = Compatibility.parse(value)
    value["qualified"]["codex"] = "0.163.0"
    value["qualified"]["unproved"] = "0.166.0"
    assert list(validator.iter_errors(value))
    with pytest.raises(QualificationError):
        _ = Compatibility.parse(value)


def test_latest_release_observation_never_promotes_pins(monkeypatch: pytest.MonkeyPatch) -> None:
    record, _ = qualify_apm.compatibility_at(qualify_apm.DEFAULT_COMPATIBILITY)
    versions = {"apm": "0.99.0", "codex": "0.999.0", "uv": "0.99.0"}

    def latest(role: str) -> str:
        return versions[role]

    monkeypatch.setattr(qualify_apm, "fetch_latest", latest)
    refreshed = qualify_apm.refresh_latest(record)
    assert refreshed.latest.data() == versions
    assert refreshed.qualified == record.qualified
    assert refreshed.source_commit == record.source_commit
    with pytest.raises(QualificationError):
        _ = qualify_apm.release_version(
            "codex", {"draft": False, "prerelease": True, "tag_name": "rust-v0.999.0"}
        )
    with pytest.raises(QualificationError):
        _ = qualify_apm.release_version(
            "uv", {"draft": False, "prerelease": False, "tag_name": "0.99.0-rc1"}
        )


def passing_candidate() -> dict[str, object]:
    _, digest = compatibility_at(DEFAULT_COMPATIBILITY)
    return {
        "status": "CANDIDATE_QUALIFIED_MECHANISMS",
        "mode": "candidate",
        "compatibilitySha256": digest,
        "qualifierSha256": hashlib.sha256(
            (DEFAULT_COMPATIBILITY.parent / "qualify_apm.py").read_bytes()
        ).hexdigest(),
        "observedVersions": {
            "apm": "0.35.0",
            "codex": "0.163.0",
            "uv": "0.99.0",
            "python": "3.12.14",
        },
        "executable_sha256": dict.fromkeys(("apm", "codex", "uv", "python"), "a" * 64),
        "files": dict.fromkeys(PLUGINS, 1),
        "native_transport": "PASS",
        "direct_session_start": "PASS",
        "frozen": "PASS",
        "owned_cleanup": "PASS",
        "approval_and_scope_refusal": "PASS",
        "loose_copilot": "UNSUPPORTED_REPRODUCED",
    }


def test_proposal_requires_complete_candidate_and_current_inputs(tmp_path: Path) -> None:
    record, digest = compatibility_at(DEFAULT_COMPATIBILITY)
    report = passing_candidate()
    proposed = propose_pins(record, digest, report)
    assert proposed.qualified.uv == "0.99.0"
    assert proposed.qualified.codex == record.qualified.codex
    output = tmp_path / "new record.json"
    write_new_json(output, proposed.data())
    assert json.loads(output.read_text()) == proposed.data()
    with pytest.raises(FileExistsError):
        write_new_json(output, record.data())
    assert json.loads(output.read_text()) == proposed.data()
    changes: tuple[tuple[str, object], ...] = (
        ("status", "UPSTREAM_REFUSED"),
        ("mode", "pinned"),
        ("compatibilitySha256", "changed"),
        ("qualifierSha256", "changed"),
        ("owned_cleanup", "NOT_TESTED"),
        ("files", {}),
    )
    for key, value in changes:
        with pytest.raises(QualificationError):
            _ = propose_pins(record, digest, {**report, key: value})


def test_upstream_refusal_is_distinct_from_other_failures() -> None:
    reason = "Codex native registration is qualified\nonly for Codex CLI 0.163.0."
    refusal = upstream_refusal(subprocess.CompletedProcess([], 1, reason, ""), "0.166.0")
    assert refusal is not None
    assert refusal.required_codex == "0.163.0"
    assert upstream_refusal(subprocess.CompletedProcess([], 0, reason, ""), "0.166.0") is None
    assert (
        upstream_refusal(subprocess.CompletedProcess([], 1, "authentication failed", ""), "0.166.0")
        is None
    )
    assert upstream_refusal(subprocess.CompletedProcess([], 1, reason, ""), "0.163.0") is None


def test_copied_bundle_exposes_record_and_refuses_missing_record(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    copied = tmp_path / "isolated tool.py"
    for source, target in (
        (root / "qualify_apm.py", copied),
        (root / "qualify_apm.py.lock", copied.with_suffix(".py.lock")),
        (root / "apm-compatibility.json", tmp_path / "apm-compatibility.json"),
    ):
        _ = shutil.copyfile(source, target)
    command = [sys.executable, str(copied), "--show-compatibility"]
    result = subprocess.run(
        command, cwd=tmp_path, capture_output=True, text=True, check=False, timeout=10
    )
    assert result.returncode == 0
    assert json.loads(result.stdout) == json.loads((root / "apm-compatibility.json").read_text())
    (tmp_path / "apm-compatibility.json").unlink()
    missing = subprocess.run(
        command, cwd=tmp_path, capture_output=True, text=True, check=False, timeout=10
    )
    assert missing.returncode != 0
    assert json.loads(missing.stdout)["status"] == "REJECTED"
