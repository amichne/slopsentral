from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "pkl-check.py"


class PklCheckHookTests(unittest.TestCase):
    def run_hook(
        self,
        root: Path,
        check: str,
        changed: str,
        pkl: Path,
        log: Path,
    ) -> subprocess.CompletedProcess[str]:
        env = dict(os.environ)
        env["INTELLIGENCE_CHANGED_FILES"] = changed
        env["PKL_BIN"] = str(pkl)
        env["PKL_FIXTURE_LOG"] = str(log)
        return subprocess.run(
            [str(SCRIPT), "--repo", str(root), "--check", check],
            text=True,
            capture_output=True,
            check=False,
            env=env,
        )

    def test_format_checks_only_changed_pkl_sources(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "config.pkl").write_text('name = "fixture"\n')
            (root / "README.md").write_text("fixture\n")
            log = root / "calls.jsonl"
            pkl = self.write_fake_pkl(root / "pkl", log)

            result = self.run_hook(root, "format", "config.pkl\nREADME.md", pkl, log)
            calls = [json.loads(line) for line in log.read_text().splitlines()]

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("status: passed", result.stdout)
        self.assertTrue(
            any("format" in call and "config.pkl" in call for call in calls),
            calls,
        )
        self.assertFalse(any("README.md" in call for call in calls), calls)

    def test_format_does_not_send_the_dependency_lock_to_the_pkl_formatter(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "config.pkl").write_text('name = "fixture"\n')
            (root / "PklProject.deps.json").write_text("{}\n")
            log = root / "calls.jsonl"
            pkl = self.write_fake_pkl(root / "pkl", log)

            result = self.run_hook(
                root,
                "format",
                "config.pkl\nPklProject.deps.json",
                pkl,
                log,
            )
            calls = [json.loads(line) for line in log.read_text().splitlines()]

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertFalse(any("PklProject.deps.json" in call for call in calls), calls)

    def test_evaluate_uses_explicit_repo_entrypoints(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / ".intelligence").mkdir()
            (root / ".intelligence" / "pkl-entrypoints").write_text(
                "# direct evaluation roots\nenv/dev.pkl\nenv/prod.pkl\n"
            )
            (root / "env").mkdir()
            (root / "env" / "dev.pkl").write_text('name = "dev"\n')
            (root / "env" / "prod.pkl").write_text('name = "prod"\n')
            log = root / "calls.jsonl"
            pkl = self.write_fake_pkl(root / "pkl", log)

            result = self.run_hook(root, "evaluate", "env/dev.pkl", pkl, log)
            calls = [json.loads(line) for line in log.read_text().splitlines()]

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        invoked = {argument for call in calls for argument in call}
        self.assertIn("env/dev.pkl", invoked)
        self.assertIn("env/prod.pkl", invoked)

    def test_evaluate_without_entrypoints_skips_with_setup_instruction(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "config.pkl").write_text('name = "fixture"\n')
            log = root / "calls.jsonl"
            pkl = self.write_fake_pkl(root / "pkl", log)

            result = self.run_hook(root, "evaluate", "config.pkl", pkl, log)

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("status: skipped", result.stdout)
        self.assertIn(".intelligence/pkl-entrypoints", result.stdout)

    def test_test_check_runs_project_assertions_in_the_agent_sandbox(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "PklProject").write_text('amends "pkl:Project"\n')
            (root / "config.test.pkl").write_text('amends "pkl:test"\n')
            log = root / "calls.jsonl"
            pkl = self.write_fake_pkl(root / "pkl", log)

            result = self.run_hook(root, "test", "config.test.pkl", pkl, log)
            calls = [json.loads(line) for line in log.read_text().splitlines()]

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(any("test" in call for call in calls), calls)

    @staticmethod
    def write_fake_pkl(path: Path, log: Path) -> Path:
        path.write_text(
            """#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

Path(os.environ["PKL_FIXTURE_LOG"]).open("a", encoding="utf-8").write(json.dumps(sys.argv[1:]) + "\\n")
if sys.argv[1:] == ["--version"]:
    print("Pkl 0.32.0 (fixture)")
raise SystemExit(0)
""",
            encoding="utf-8",
        )
        path.chmod(0o755)
        return path


if __name__ == "__main__":
    unittest.main()
