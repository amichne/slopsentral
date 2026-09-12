import importlib.util
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "repository_profile", Path(__file__).resolve().parents[1] / "repository-profile.py"
)
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)


class RepositoryProfileHookTests(unittest.TestCase):
    def test_missing_cli_is_an_explicit_advisory(self):
        self.assertIn("SLOPSENTRAL_CLI_MISSING", hook.run(b"{}", None)["systemMessage"])

    def test_no_op_does_not_inject_context(self):
        with patch.object(hook.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, b"{}", b"")):
            self.assertEqual(hook.run(b"{}", "/bin/slopsentral"), {})

    def test_expected_context_notice_is_preserved(self):
        output = {"systemMessage": "Configuration loads in the next session."}
        with patch.object(hook.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, json.dumps(output).encode(), b"")) as run:
            self.assertEqual(hook.run(b"event", "/bin/slopsentral"), output)
            self.assertEqual(run.call_args.args[0], ["/bin/slopsentral", "context", "hook"])
            self.assertEqual(run.call_args.kwargs["input"], b"event")

    def test_failed_or_unexpected_output_never_becomes_model_context(self):
        for returncode, stdout in [(1, b"secret"), (0, b"secret"), (0, b'{"hookSpecificOutput":{"additionalContext":"secret"}}')]:
            with patch.object(hook.subprocess, "run", return_value=subprocess.CompletedProcess([], returncode, stdout, b"secret")):
                result = hook.run(b"input-secret", "/bin/slopsentral")
                self.assertNotIn("secret", json.dumps(result))
                self.assertEqual(set(result), {"systemMessage"})

    def test_oversized_events_are_rejected_before_running_the_cli(self):
        with patch.object(hook.subprocess, "run") as run:
            self.assertIn("INVALID_HOOK_INPUT", hook.run(b"x" * 65537, "/bin/slopsentral")["systemMessage"])
            run.assert_not_called()

    def test_timeout_has_a_distinct_outcome(self):
        with patch.object(hook.subprocess, "run", side_effect=subprocess.TimeoutExpired("slopsentral", 45)):
            self.assertIn("CONTEXT_COMMAND_TIMED_OUT", hook.run(b"{}", "/bin/slopsentral")["systemMessage"])


if __name__ == "__main__":
    unittest.main()
