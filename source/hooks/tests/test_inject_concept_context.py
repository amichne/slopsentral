import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "source" / "hooks" / "inject-concept-context.py"


class InjectConceptContextTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.plugin_root = self.root / "plugin"
        self.instructions = self.plugin_root / "instructions"
        self.instructions.mkdir(parents=True)
        self.transcript = self.root / "transcript.jsonl"
        self.transcript.write_text("session\n", encoding="utf-8")
        self.state = self.root / "state"

    def run_hook(self, concept="type-safety", source="startup"):
        event = {
            "session_id": "session-123",
            "transcript_path": str(self.transcript),
            "cwd": str(self.root),
            "hook_event_name": "SessionStart",
            "source": source,
        }
        environment = os.environ.copy()
        environment["PLUGIN_ROOT"] = str(self.plugin_root)
        environment["SLOPSENTRAL_CONTEXT_STATE_DIR"] = str(self.state)
        return subprocess.run(
            ["python3", str(SCRIPT), "--concept", concept],
            input=json.dumps(event),
            text=True,
            capture_output=True,
            env=environment,
            check=False,
        )

    def test_emits_concept_as_session_start_additional_context(self):
        concept = "# Type Safety\n\nPreserve proven invariants.\n"
        (self.instructions / "type-safety.md").write_text(concept, encoding="utf-8")

        result = self.run_hook()

        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["hookSpecificOutput"]["hookEventName"], "SessionStart")
        self.assertIn(concept.strip(), payload["hookSpecificOutput"]["additionalContext"])

    def test_deduplicates_the_same_concept_for_one_session_start_event(self):
        (self.instructions / "type-safety.md").write_text("# Type Safety\n", encoding="utf-8")

        first = self.run_hook()
        second = self.run_hook()

        self.assertTrue(first.stdout)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(second.stdout, "")

    def test_reinjects_after_the_transcript_changes(self):
        (self.instructions / "type-safety.md").write_text("# Type Safety\n", encoding="utf-8")
        first = self.run_hook(source="compact")
        self.transcript.write_text("session\ncompacted\n", encoding="utf-8")

        second = self.run_hook(source="compact")

        self.assertTrue(first.stdout)
        self.assertTrue(second.stdout)

    def test_missing_concept_fails_closed(self):
        result = self.run_hook(concept="kotlin-code-correctness")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertIn("missing bundled concept", result.stderr)


if __name__ == "__main__":
    unittest.main()
