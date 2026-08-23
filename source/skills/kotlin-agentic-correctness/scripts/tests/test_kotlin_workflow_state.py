from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "kotlin_task_evidence"


class KotlinWorkflowStateTaskProofTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.repo = Path(self.temporary.name)
        self.task_dir = self.repo / ".agent-turn" / "session" / "tasks" / "001"
        self.task_dir.mkdir(parents=True)
        self.write_task()

    def write_task(self, *, red_exit: int = 0, green_exit: int = 0) -> None:
        (self.task_dir / "TASK.md").write_text(
            "# Task\n\nChange the behavior and prove the requested outcome.\n",
            encoding="utf-8",
        )
        (self.task_dir / "red.md").write_text(
            "# Red\n\n`red.sh` is the authority for the observed missing behavior.\n",
            encoding="utf-8",
        )
        (self.task_dir / "green.md").write_text(
            "# Green\n\n`green.sh` is the authority for the completed behavior.\n",
            encoding="utf-8",
        )
        self.write_script("red.sh", "expected missing behavior observed", red_exit)
        self.write_script("green.sh", "required behavior observed", green_exit)

    def write_script(self, name: str, observation: str, exit_code: int) -> None:
        path = self.task_dir / name
        path.write_text(
            f"#!/bin/sh\nset -eu\nprintf '%s\\n' '{observation}'\nexit {exit_code}\n",
            encoding="utf-8",
        )
        path.chmod(0o755)

    def run_cli(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            cwd=self.repo,
            text=True,
            capture_output=True,
            check=False,
        )

    def run_phase(self, phase: str) -> subprocess.CompletedProcess[str]:
        return self.run_cli(
            "run",
            "--repo",
            str(self.repo),
            "--task-dir",
            str(self.task_dir),
            "--phase",
            phase,
        )

    def check_phase(self, phase: str) -> subprocess.CompletedProcess[str]:
        return self.run_cli(
            "check",
            "--repo",
            str(self.repo),
            "--task-dir",
            str(self.task_dir),
            "--phase",
            phase,
        )

    def test_complete_task_accepts_current_red_and_green_proof(self) -> None:
        self.assertEqual(self.run_phase("red").returncode, 0)
        self.assertEqual(self.run_phase("green").returncode, 0)

        result = self.check_phase("complete")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)["valid"])
        red_proof = (self.task_dir / "red-proof.out").read_text(encoding="utf-8")
        self.assertIn("proof-script: red.sh", red_proof)
        self.assertIn("expected missing behavior observed", red_proof)
        self.assertIn("proof-exit-code: 0", red_proof)

    def test_definition_change_makes_existing_proof_stale(self) -> None:
        self.assertEqual(self.run_phase("red").returncode, 0)
        with (self.task_dir / "TASK.md").open("a", encoding="utf-8") as handle:
            handle.write("The requested outcome changed.\n")

        result = self.check_phase("red")

        self.assertEqual(result.returncode, 1)
        self.assertIn("stale for the current task definition", result.stderr)

    def test_nonzero_proof_script_is_captured_and_rejected(self) -> None:
        self.write_task(red_exit=7)

        run = self.run_phase("red")
        check = self.check_phase("red")

        self.assertEqual(run.returncode, 7)
        self.assertEqual(check.returncode, 1)
        self.assertIn("did not exit successfully", check.stderr)
        self.assertIn("proof-exit-code: 7", (self.task_dir / "red-proof.out").read_text(encoding="utf-8"))

    def test_definition_changed_by_script_makes_captured_proof_stale(self) -> None:
        script = self.task_dir / "red.sh"
        script.write_text(
            "#!/bin/sh\nset -eu\nprintf '%s\\n' 'observed before mutation'\nprintf '%s\\n' 'mutated' >> .agent-turn/session/tasks/001/TASK.md\n",
            encoding="utf-8",
        )
        script.chmod(0o755)

        self.assertEqual(self.run_phase("red").returncode, 0)
        result = self.check_phase("red")

        self.assertEqual(result.returncode, 1)
        self.assertIn("stale for the current task definition", result.stderr)

    def test_proof_without_observed_output_is_rejected(self) -> None:
        script = self.task_dir / "red.sh"
        script.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        script.chmod(0o755)
        self.assertEqual(self.run_phase("red").returncode, 0)

        result = self.check_phase("red")

        self.assertEqual(result.returncode, 1)
        self.assertIn("no observed check output", result.stderr)


if __name__ == "__main__":
    unittest.main()
