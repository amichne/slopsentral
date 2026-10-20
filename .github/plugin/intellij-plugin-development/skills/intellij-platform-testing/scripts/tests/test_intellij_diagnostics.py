import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).parents[1] / "intellij_diagnostics"


class IntelliJDiagnosticsTest(unittest.TestCase):
    def run_helper(self, *args: str, expected: int = 0):
        result = subprocess.run(
            [str(SCRIPT), *args], text=True, capture_output=True, check=False
        )
        self.assertEqual(result.returncode, expected, result.stderr)
        stream = result.stdout if expected == 0 else result.stderr
        return json.loads(stream)

    def test_compare_reports_cpu_threads_states_and_capture_flags(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            before = root / "before.json"
            during = root / "during.json"
            before.write_text(json.dumps({
                "process": {"processCpuLoad": 0.2, "systemCpuLoad": 0.4},
                "threads": {"stateCounts": {"RUNNABLE": 4, "BLOCKED": 1}},
                "topCpuThreads": [{"id": 7, "name": "worker", "cpuDeltaNanos": 10}],
            }))
            during.write_text(json.dumps({
                "process": {"processCpuLoad": 0.7, "systemCpuLoad": 0.6},
                "threads": {"stateCounts": {"RUNNABLE": 6, "BLOCKED": 3}},
                "topCpuThreads": [{
                    "id": 7, "name": "worker", "state": "RUNNABLE",
                    "cpuDeltaNanos": 40, "blockedCountDelta": 2,
                    "waitedCountDelta": 1, "stackTrace": ["pkg.Hot.run(Hot.kt:1)"],
                }],
                "rawDumpTruncated": True, "coroutineDumpEnabled": False,
            }))
            result = self.run_helper(
                "compare", "--before", str(before), "--during", str(during)
            )
            self.assertAlmostEqual(result["process"]["cpuLoadDelta"], 0.5)
            self.assertEqual(result["threadStateDeltas"]["BLOCKED"], 2)
            self.assertEqual(result["topCpuThreadsDuring"][0]["cpuDeltaChangeNanos"], 30)
            self.assertTrue(result["rawDumpTruncated"])
            self.assertFalse(result["coroutineDumpEnabled"])

    def test_trace_plan_accepts_only_concrete_fqcn_method(self):
        result = self.run_helper(
            "trace-plan", "--method", "com.intellij.psi.PsiReference#resolve"
        )
        self.assertEqual(result["commands"], [
            "clear", "trace com.intellij.psi.PsiReference#resolve", "reset"
        ])
        error = self.run_helper(
            "trace-plan", "--method", "com.intellij.psi.*#resolve", expected=1
        )
        self.assertIn("concrete FQCN#method", error["message"])

    def test_vm_options_dry_run_apply_backup_and_noop(self):
        with tempfile.TemporaryDirectory() as directory:
            options = Path(directory) / "custom.vmoptions"
            options.write_text("-Xmx2g\n")
            preview = self.run_helper(
                "vm-options", "--file", str(options), "--enable", "both"
            )
            self.assertEqual(preview["status"], "DRY_RUN")
            self.assertEqual(options.read_text(), "-Xmx2g\n")
            applied = self.run_helper(
                "vm-options", "--file", str(options), "--enable", "both", "--apply"
            )
            self.assertEqual(applied["status"], "APPLIED")
            backup = Path(applied["backup"])
            self.assertEqual(backup.read_text(), "-Xmx2g\n")
            self.assertIn("-Didea.diagnostics.mcp.enabled=true", options.read_text())
            noop = self.run_helper(
                "vm-options", "--file", str(options), "--enable", "both", "--apply"
            )
            self.assertEqual(noop["status"], "NOOP")
            self.assertEqual(len(list(options.parent.glob("*.backup.*"))), 1)

    def test_vm_options_rejects_symlinks_and_installation_files(self):
        with tempfile.TemporaryDirectory(suffix=".app") as directory:
            root = Path(directory)
            custom = root / "custom.vmoptions"
            custom.write_text("-Xmx2g\n")
            link = root / "link.vmoptions"
            link.symlink_to(custom)
            self.run_helper(
                "vm-options", "--file", str(link), "--enable", "mcp", expected=1
            )
            install = root / "Contents" / "bin" / "idea.vmoptions"
            install.parent.mkdir(parents=True)
            install.write_text("-Xmx2g\n")
            error = self.run_helper(
                "vm-options", "--file", str(install), "--enable", "mcp", expected=1
            )
            self.assertIn("installation-owned", error["message"])

    def test_ide_perf_command_is_emitted_and_not_executed(self):
        with tempfile.TemporaryDirectory() as directory:
            launcher = Path(directory) / "idea"
            launcher.write_text("#!/bin/sh\nexit 99\n")
            os.chmod(launcher, 0o755)
            result = self.run_helper("ide-perf-command", "--launcher", str(launcher))
            self.assertFalse(result["executed"])
            self.assertEqual(result["argv"][-2:], ["installPlugins", "com.google.ide-perf"])


if __name__ == "__main__":
    unittest.main()
