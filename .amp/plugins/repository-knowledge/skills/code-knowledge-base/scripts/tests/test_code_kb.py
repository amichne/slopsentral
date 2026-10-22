from __future__ import annotations

import importlib.util
import io
import json
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "code_kb.py"
SPEC = importlib.util.spec_from_file_location("code_kb", SCRIPT)
assert SPEC and SPEC.loader
CODE_KB = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CODE_KB)


class CodeKnowledgeBaseTest(unittest.TestCase):
    def run_command(self, *arguments: str) -> tuple[int, dict[str, object]]:
        stdout = io.StringIO()
        with redirect_stdout(stdout):
            return_code = CODE_KB.main([*arguments, "--format", "json"])
        return return_code, json.loads(stdout.getvalue())

    def make_bundle(self, repo: Path) -> None:
        (repo / "docs").mkdir()
        (repo / "src").mkdir()
        (repo / "src/App.kt").write_text("class App\n", encoding="utf-8")
        (repo / "docs/app.md").write_text(
            "---\ntype: Kotlin Type\ncode_sources:\n  - path: src/App.kt\n---\n",
            encoding="utf-8",
        )

    def test_missing_or_empty_bundle_is_not_success(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            for exists in (False, True):
                if exists:
                    (repo / "docs").mkdir()
                for command in ("check", "impact"):
                    with self.subTest(exists=exists, command=command):
                        code, payload = self.run_command(command, "--repo", directory)
                        self.assertNotEqual(0, code)
                        self.assertEqual("error", payload["status"])
                        self.assertEqual("documents", payload["error"]["stage"])

    def test_git_failure_is_not_an_empty_change_set(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.make_bundle(Path(directory))
            code, payload = self.run_command("impact", "--repo", directory, "--from-git")
        self.assertNotEqual(0, code)
        self.assertEqual({"stage": "git-status", "code": "git-status-failed"}, payload["error"])
        self.assertNotIn("impactedPages", payload)

    def test_unavailable_git_reports_bounded_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.make_bundle(Path(directory))
            with patch.object(CODE_KB.subprocess, "run", side_effect=FileNotFoundError("private detail")):
                code, payload = self.run_command("impact", "--repo", directory, "--from-git")
        self.assertNotEqual(0, code)
        self.assertEqual({"stage": "git-status", "code": "git-unavailable"}, payload["error"])
        self.assertNotIn("private detail", json.dumps(payload))

    def test_normalized_changed_path_retains_impact(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.make_bundle(Path(directory))
            code, payload = self.run_command(
                "impact", "--repo", directory, "--changed-file", "./src/App.kt"
            )
        self.assertEqual(0, code)
        self.assertEqual("ok", payload["status"])
        self.assertEqual(["src/App.kt"], payload["changedFiles"])
        self.assertEqual(["src/App.kt"], payload["impactedPages"][0]["matchedSources"])

    def test_invalid_changed_path_is_not_silently_dropped(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.make_bundle(Path(directory))
            code, payload = self.run_command(
                "impact", "--repo", directory, "--changed-file", "../outside.kt"
            )
        self.assertNotEqual(0, code)
        self.assertEqual("invalid-changed-path", payload["error"]["code"])

    def test_clean_git_success_and_rename_preserve_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.make_bundle(Path(directory))
            cases = ((b"", []), (b"R  src/New.kt\0src/App.kt\0", ["src/App.kt", "src/New.kt"]))
            for output, expected in cases:
                with self.subTest(output=output), patch.object(
                    CODE_KB.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, output, b"")
                ):
                    code, payload = self.run_command("impact", "--repo", directory, "--from-git")
                    self.assertEqual(0, code)
                    self.assertEqual("ok", payload["status"])
                    self.assertEqual(expected, payload["changedFiles"])

    def test_truncated_git_output_is_not_success(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.make_bundle(Path(directory))
            with patch.object(
                CODE_KB.subprocess, "run",
                return_value=subprocess.CompletedProcess([], 0, b"R  src/New.kt\0", b"")
            ):
                code, payload = self.run_command("impact", "--repo", directory, "--from-git")
        self.assertNotEqual(0, code)
        self.assertEqual("invalid-git-status", payload["error"]["code"])

    def test_strict_check_rejects_missing_type(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repo = Path(temporary_directory)
            docs = repo / "docs"
            docs.mkdir()
            (docs / "broken.md").write_text(
                "---\ntitle: Missing type\n---\n\n# Broken\n",
                encoding="utf-8",
            )

            return_code, payload = self.run_command(
                "check", "--repo", str(repo), "--docs", "docs", "--strict"
            )

        self.assertEqual(1, return_code)
        self.assertEqual(1, payload["issueCount"])
        self.assertEqual(
            [{"message": "frontmatter type is required", "path": "docs/broken.md"}],
            payload["issues"],
        )

    def test_impact_maps_changed_source_to_concept(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repo = Path(temporary_directory)
            docs = repo / "docs"
            source = repo / "src" / "App.kt"
            docs.mkdir()
            source.parent.mkdir()
            source.write_text("class App\n", encoding="utf-8")
            (docs / "application.md").write_text(
                "---\ntype: Kotlin Type\ncode_sources:\n  - path: src/App.kt\n---\n\n# Application\n",
                encoding="utf-8",
            )

            return_code, payload = self.run_command(
                "impact",
                "--repo",
                str(repo),
                "--docs",
                "docs",
                "--changed-file",
                "src/App.kt",
            )

        self.assertEqual(0, return_code)
        self.assertEqual(
            [
                {
                    "conceptId": "application",
                    "matchedSources": ["src/App.kt"],
                    "pageChanged": False,
                    "path": "docs/application.md",
                }
            ],
            payload["impactedPages"],
        )


if __name__ == "__main__":
    unittest.main()
