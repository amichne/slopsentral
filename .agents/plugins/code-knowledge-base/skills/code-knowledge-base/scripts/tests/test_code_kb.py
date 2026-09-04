from __future__ import annotations

import importlib.util
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path


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
