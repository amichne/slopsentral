from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from tools.qualify_apm import (
    Programs,
    QualificationError,
    Trial,
    context_response,
    failure_response,
    inventory,
    qualify,
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
