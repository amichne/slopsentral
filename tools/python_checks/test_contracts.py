from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

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


def test_pep723_isolation() -> None:
    script = ROOT / "source/skills/python-tooling/assets/standalone.py"
    result = subprocess.run(
        ["uv", "run", "--locked", "--script", str(script), "--self-test"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "4 passed" in result.stdout
