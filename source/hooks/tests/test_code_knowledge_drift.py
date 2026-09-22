from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


HOOK = Path(__file__).resolve().parents[1] / "code-knowledge-drift.py"


class KnowledgeDriftTest(unittest.TestCase):
    def run_hook(self, repo: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(HOOK), "--repo", str(repo), "--format", "json", *arguments],
            cwd=repo, capture_output=True, text=True, check=False,
        )

    def make_bundle(self, repo: Path) -> None:
        (repo / "docs").mkdir()
        (repo / "App.kt").write_text("class App\n", encoding="utf-8")
        (repo / "docs/app.md").write_text(
            "---\ntype: Kotlin Type\ncode_sources:\n  - path: App.kt\n---\n",
            encoding="utf-8",
        )

    def test_advisory_failure_is_visible_without_blocking(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            self.make_bundle(repo)
            for arguments, expected_code in (((), 1), (("--advisory",), 0)):
                with self.subTest(arguments=arguments):
                    result = self.run_hook(repo, *arguments)
                    self.assertEqual(expected_code, result.returncode, result.stderr)
                    payload = json.loads(result.stdout)
                    self.assertEqual("error", payload["status"])
                    self.assertEqual("git-status-failed", payload["error"]["code"])
                    self.assertNotIn("impactedConcepts", payload)

    def test_shared_impact_and_metadata_validation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            self.make_bundle(repo)
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            result = self.run_hook(repo, "--advisory", "--changed-file", "./App.kt")
            self.assertEqual(0, result.returncode, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual("ok", payload["status"])
            self.assertEqual(["App.kt"], payload["impactedConcepts"][0]["matchedSources"])
            (repo / "docs/app.md").write_text("---\ntitle: Missing type\n---\n", encoding="utf-8")
            result = self.run_hook(repo)
            self.assertEqual(1, result.returncode, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual("invalid", payload["status"])
            self.assertEqual("frontmatter type is required", payload["issues"][0]["message"])


if __name__ == "__main__":
    unittest.main()
