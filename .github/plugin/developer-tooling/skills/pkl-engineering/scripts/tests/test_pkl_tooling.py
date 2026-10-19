from __future__ import annotations

import os
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "pkl_tooling"


class PklToolingCliTests(unittest.TestCase):
    def run_cli(
        self,
        *args: str,
        env: dict[str, str] | None = None,
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(SCRIPT), *args],
            text=True,
            capture_output=True,
            check=False,
            env=env,
        )

    def test_doctor_reports_cli_and_workspace_without_promoting_integrations(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            pkl = self.write_executable(root / "pkl", "Pkl 0.32.0 (fixture)")
            result = self.run_cli("--workspace", str(root), "--pkl-bin", str(pkl), "doctor")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("pkl_status: ready", result.stdout)
        self.assertIn("pkl_version: 0.32.0", result.stdout)
        self.assertNotIn("lsp", result.stdout)
        self.assertNotIn("editor", result.stdout)

    def test_missing_pkl_is_actionable_and_nonzero(self) -> None:
        env = dict(os.environ)
        env["PKL_BIN"] = "/nonexistent/pkl"

        result = self.run_cli("doctor", env=env)

        self.assertEqual(result.returncode, 1)
        self.assertIn("pkl_status: missing", result.stdout)
        self.assertIn("pkl_tooling install-plan cli", result.stdout)

    def test_editor_install_plans_are_rejected(self) -> None:
        result = self.run_cli("install-plan", "lsp", "--editor", "vscode")
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertNotIn("status: plan", result.stdout)

    def test_capabilities_contains_only_the_retained_cli(self) -> None:
        result = self.run_cli("capabilities")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("tooling[1]: pkl", result.stdout)
        self.assertNotIn("editors", result.stdout)
        self.assertNotIn("code generators", result.stdout)

    @staticmethod
    def write_executable(path: Path, output: str) -> Path:
        path.write_text(f"#!/bin/sh\nprintf '%s\\n' '{output}'\n", encoding="utf-8")
        path.chmod(0o755)
        return path


if __name__ == "__main__":
    unittest.main()
