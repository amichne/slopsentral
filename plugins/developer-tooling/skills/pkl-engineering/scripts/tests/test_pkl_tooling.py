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

    def test_doctor_reports_cli_java_lsp_and_workspace_state(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            pkl = self.write_executable(root / "pkl", "Pkl 0.32.0 (fixture)")
            java = self.write_executable(root / "java", 'openjdk version "23.0.2"')
            lsp = root / "pkl-lsp.jar"
            lsp.write_bytes(b"fixture")
            workspace = root / "workspace"
            workspace.mkdir()
            (workspace / "PklProject").write_text("amends \"pkl:Project\"\n")
            (workspace / "config.pkl").write_text("name = \"fixture\"\n")

            result = self.run_cli(
                "--workspace",
                str(workspace),
                "--pkl-bin",
                str(pkl),
                "--java-bin",
                str(java),
                "--lsp-jar",
                str(lsp),
                "doctor",
            )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("pkl_status: ready", result.stdout)
        self.assertIn("pkl_version: 0.32.0", result.stdout)
        self.assertIn("java_status: ready", result.stdout)
        self.assertIn("lsp_status: ready", result.stdout)
        self.assertIn("modules: 1", result.stdout)

    def test_missing_pkl_is_actionable_and_nonzero(self) -> None:
        env = dict(os.environ)
        env["PKL_BIN"] = "/nonexistent/pkl"

        result = self.run_cli("doctor", env=env)

        self.assertEqual(result.returncode, 1)
        self.assertIn("pkl_status: missing", result.stdout)
        self.assertIn("pkl_tooling install-plan cli", result.stdout)

    def test_install_plan_is_non_mutating_and_routes_to_official_tools(self) -> None:
        result = self.run_cli("install-plan", "lsp", "--editor", "vscode")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("status: plan", result.stdout)
        self.assertIn("pkl-vscode/releases/latest", result.stdout)
        self.assertIn("pkl.lsp.java.path", result.stdout)

    @staticmethod
    def write_executable(path: Path, output: str) -> Path:
        path.write_text(f"#!/bin/sh\nprintf '%s\\n' '{output}'\n", encoding="utf-8")
        path.chmod(0o755)
        return path


if __name__ == "__main__":
    unittest.main()
