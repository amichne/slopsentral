from __future__ import annotations

import importlib.util
import sys
import unittest
from importlib.machinery import SourceFileLoader
from pathlib import Path
from typing import Sequence


SCRIPT = Path(__file__).resolve().parents[1] / "github-actions-await.py"
LOADER = SourceFileLoader("github_actions_await", str(SCRIPT))
SPEC = importlib.util.spec_from_loader(LOADER.name, LOADER)
assert SPEC is not None
hook = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = hook
assert SPEC.loader is not None
SPEC.loader.exec_module(hook)


EVENT = {
    "outcome": "pending",
    "predicate": "status-change",
    "target": {"kind": "RUN", "value": "123", "required": False},
    "previous": {"summary": "run 123 queued", "stateKey": "queued"},
    "current": {"summary": "run 123 in_progress", "stateKey": "running"},
    "polls": 4,
    "finishedAt": "2026-07-10T12:05:00Z",
}


class FakeCli:
    def __init__(self, responses: list[object]):
        self.responses = list(responses)
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, args: Sequence[str]) -> object:
        self.calls.append(tuple(args))
        if not self.responses:
            raise AssertionError(f"unexpected observer CLI call: {tuple(args)}")
        return self.responses.pop(0)


class GithubActionsAwaitHookTests(unittest.TestCase):
    def test_guard_denies_raw_gh_observation(self) -> None:
        output = hook.guard_output(
            {
                "tool_name": "Bash",
                "tool_input": {"command": "gh run watch 123"},
            }
        )

        self.assertEqual(output["hookSpecificOutput"]["permissionDecision"], "deny")
        self.assertIn("gh-axi", output["hookSpecificOutput"]["permissionDecisionReason"])

    def test_guard_denies_github_mcp(self) -> None:
        output = hook.guard_output(
            {
                "tool_name": "mcp__codex_apps__github_get_workflow_run",
                "tool_input": {"run_id": 123},
            }
        )

        self.assertEqual(output["hookSpecificOutput"]["permissionDecision"], "deny")

    def test_guard_allows_gh_axi_and_unrelated_shell(self) -> None:
        self.assertIsNone(
            hook.guard_output(
                {
                    "tool_name": "Bash",
                    "tool_input": {"command": "npx -y gh-axi run view 123"},
                }
            )
        )
        self.assertIsNone(
            hook.guard_output(
                {
                    "tool_name": "Bash",
                    "tool_input": {"command": "git status --short"},
                }
            )
        )

    def test_stop_allows_idle_turn_to_finish(self) -> None:
        fake = FakeCli([hook.CliResult(0, {"state": "idle"})])

        output = hook.stop_output(Path("/repo"), fake)

        self.assertEqual(output, {"continue": True})
        self.assertEqual(fake.calls, [("--repo", "/repo", "status", "--json")])

    def test_stop_continues_model_once_for_observation_event(self) -> None:
        fake = FakeCli(
            [
                hook.CliResult(0, {"state": "armed"}),
                hook.CliResult(0, EVENT),
            ]
        )

        output = hook.stop_output(Path("/repo"), fake)

        self.assertEqual(output["decision"], "block")
        self.assertIn("status-change", output["reason"])
        self.assertIn("run 123 in_progress", output["reason"])
        self.assertEqual(len(fake.calls), 2)

    def test_stop_surfaces_timeout_as_one_continuation(self) -> None:
        timeout = dict(EVENT, outcome="timeout")
        fake = FakeCli(
            [
                hook.CliResult(0, {"state": "armed"}),
                hook.CliResult(124, timeout),
            ]
        )

        output = hook.stop_output(Path("/repo"), fake)

        self.assertEqual(output["decision"], "block")
        self.assertIn("timeout", output["reason"])


if __name__ == "__main__":
    unittest.main()
