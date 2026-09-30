import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "inject-instruction-context.py"


class InstructionContextTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.plugin = self.root / "plugin"
        self.instructions = self.plugin / "instructions"
        self.instructions.mkdir(parents=True)
        self.environment = {**os.environ, "PLUGIN_ROOT": str(self.plugin)}

    def run_hook(self, names=("agent-execution",), source="startup", raw=None, environment=None):
        event = {"hook_event_name": "SessionStart", "source": source, "session_id": "session-123"}
        command = ["python3", str(SCRIPT)]
        for name in names:
            command.extend(["--instruction", name])
        result = subprocess.run(command, input=json.dumps(event) if raw is None else raw,
                                text=True, capture_output=True, env=environment or self.environment,
                                cwd=self.root, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout), json.loads(result.stderr)

    def write(self, name, text):
        (self.instructions / f"{name}.md").write_text(text, encoding="utf-8")

    def assert_failure(self, output, evidence, code):
        self.assertEqual(evidence, {"type": "INSTRUCTION_CONTEXT_FAILED", "code": code})
        self.assertIs(output["continue"], False)
        self.assertNotIn("hookSpecificOutput", output)
        self.assertIn(code, output["stopReason"])

    def test_complete_bundle_is_delivered_for_each_supported_lifecycle_event(self):
        self.write("agent-execution", "# Agent Execution\n\nComplete authorized work.\n")
        self.write("engineering-design", "# Engineering Design\n\nRetain domain proofs.\n")
        before = sorted(str(file.relative_to(self.root)) for file in self.root.rglob("*"))
        for source in ("startup", "resume", "clear", "compact"):
            with self.subTest(source=source):
                output, evidence = self.run_hook(("agent-execution", "engineering-design"), source)
                self.assertEqual(output["hookSpecificOutput"]["hookEventName"], "SessionStart")
                context = output["hookSpecificOutput"]["additionalContext"]
                self.assertIn("Complete authorized work.", context)
                self.assertIn("Retain domain proofs.", context)
                self.assertEqual(evidence["instructions"], ["agent-execution", "engineering-design"])
                self.assertEqual(evidence["bytes"], len(context.encode("utf-8")))
                self.assertEqual(len(evidence["sha256"]), 64)
                self.assertNotIn(context, json.dumps(evidence))
        self.assertEqual(before, sorted(str(file.relative_to(self.root)) for file in self.root.rglob("*")))

    def test_repeated_event_never_claims_previously_emitted_context_was_loaded(self):
        self.write("agent-execution", "Preserve user authority.")
        self.assertEqual(self.run_hook(), self.run_hook())

    def test_missing_second_policy_never_delivers_partial_context(self):
        self.write("agent-execution", "private-first-policy")
        output, evidence = self.run_hook(("agent-execution", "engineering-design"))
        self.assert_failure(output, evidence, "POLICY_UNAVAILABLE")
        self.assertNotIn("private-first-policy", json.dumps(output) + json.dumps(evidence))

    def test_invalid_event_shapes_and_sources_fail_explicitly(self):
        for raw in ("not-json", "[]", "{}", '{"hook_event_name":"Stop"}',
                    '{"hook_event_name":"SessionStart","source":"future","session_id":"secret"}',
                    '{"hook_event_name":"SessionStart","source":"startup","session_id":""}'):
            with self.subTest(raw=raw):
                self.assert_failure(*self.run_hook(raw=raw), "INVALID_EVENT")

    def test_oversized_event_is_bounded(self):
        self.assert_failure(*self.run_hook(raw="x" * (64 * 1024 + 1)), "EVENT_TOO_LARGE")

    def test_selection_is_closed_and_unique(self):
        for names in ((), ("unknown-policy",), ("../secret",), ("agent-execution", "agent-execution")):
            with self.subTest(names=names):
                self.assert_failure(*self.run_hook(names), "INVALID_SELECTION")

    def test_missing_root_is_not_inferred_from_cwd(self):
        environment = {key: value for key, value in self.environment.items() if key != "PLUGIN_ROOT"}
        self.assert_failure(*self.run_hook(environment=environment), "INVALID_PLUGIN_ROOT")

    def test_empty_or_non_utf8_policy_is_rejected(self):
        for data in (b" \n", b"\xff"):
            with self.subTest(data=data):
                (self.instructions / "agent-execution.md").write_bytes(data)
                self.assert_failure(*self.run_hook(), "INVALID_POLICY")

    def test_oversized_individual_or_combined_context_is_rejected_without_truncation(self):
        self.write("agent-execution", "x" * 8193)
        self.assert_failure(*self.run_hook(), "CONTEXT_TOO_LARGE")
        self.write("agent-execution", "x" * 4096)
        self.write("engineering-design", "y" * 4096)
        self.assert_failure(*self.run_hook(("agent-execution", "engineering-design")), "CONTEXT_TOO_LARGE")

    def test_policy_symlink_cannot_escape_the_installed_package(self):
        outside = self.root / "outside.md"
        outside.write_text("private-outside-content")
        (self.instructions / "agent-execution.md").symlink_to(outside)
        self.assert_failure(*self.run_hook(), "POLICY_ESCAPES_ROOT")


if __name__ == "__main__":
    unittest.main()
