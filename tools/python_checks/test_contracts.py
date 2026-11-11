from __future__ import annotations

import json
import os
import subprocess
import sys
import tomllib
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def test_forbidden_branch_is_rejected(tmp_path: Path) -> None:
    fixture = ROOT / "tools/python_checks/fixtures/non_exhaustive.py"
    config = tmp_path / "pyrightconfig.json"
    _ = config.write_text(json.dumps({"typeCheckingMode": "strict", "pythonVersion": "3.12"}))
    result = subprocess.run(
        [sys.executable, "-m", "pyright", "--project", str(config), "--outputjson", str(fixture)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1, result.stderr
    report = json.loads(result.stdout)
    assert report["summary"]["filesAnalyzed"] == 1
    errors = [item for item in report["generalDiagnostics"] if item["severity"] == "error"]
    assert len(errors) == 1
    assert errors[0]["rule"] == "reportArgumentType"
    assert "Literal['invalid']" in errors[0]["message"]
    assert "Never" in errors[0]["message"]


def test_pep723_isolation(tmp_path: Path) -> None:
    script = ROOT / "source/skills/python-tooling/assets/standalone.py"
    sample = tmp_path / "sample.txt"
    _ = sample.write_text("hello\n")
    result = subprocess.run(
        ["uv", "run", "--script", str(script), str(sample)],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {"type": "SUMMARY", "lines": 1, "characters": 6}
    assert list(tmp_path.glob("*.lock")) == []


def test_scaffold_exposes_extensionless_command_with_checkout_uv_pin(tmp_path: Path) -> None:
    script = ROOT / "source/skills/python-tooling/scripts/python-scaffold"
    destination = tmp_path / "project with spaces"
    _ = subprocess.run(
        [str(script), "--out", str(destination)],
        check=True,
    )

    def uv_pin(config: Path) -> str:
        return tomllib.loads(config.read_text())["tools"]["uv"]

    assert (destination / "uv.toml").is_file()
    assert list(destination.rglob("*.lock")) == []
    assert uv_pin(destination / "mise.toml") == uv_pin(ROOT / "mise.toml")
    if os.name != "posix":
        pytest.skip("Direct shebang commands on PATH need a POSIX host.")
    assert (destination / "bin/automation-setup").is_symlink()
    assert "uv.lock" in (destination / ".gitignore").read_text()
    sample = tmp_path / "sample with spaces.txt"
    _ = sample.write_text("hello\n")
    result = subprocess.run(
        ["mise", "exec", "--", "text-summary", str(sample)],
        cwd=destination,
        env={**os.environ, "MISE_TRUSTED_CONFIG_PATHS": str(destination)},
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {"type": "SUMMARY", "lines": 1, "characters": 6}
    rejected = subprocess.run(
        ["text-summary", str(tmp_path / "absent")],
        cwd=tmp_path,
        env={**os.environ, "PATH": os.pathsep.join([str(destination / "bin"), os.environ["PATH"]])},
        text=True,
        capture_output=True,
        check=False,
    )
    assert rejected.returncode == 1, rejected.stderr
    assert json.loads(rejected.stdout) == {"type": "UNREADABLE"}
    assert list(destination.rglob("*.lock")) == []
