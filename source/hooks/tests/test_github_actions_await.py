from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from importlib.machinery import SourceFileLoader
from pathlib import Path
from typing import Sequence


SCRIPT = Path(__file__).resolve().parents[1] / "github-actions-await.py"
ADAPTER = SCRIPT.parent / "codex/github-actions-await.hooks.json"
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
    def test_session_start_loads_gh_axi_ambient_context(self) -> None:
        adapter = json.loads(ADAPTER.read_text())

        session_start = adapter["hooks"]["SessionStart"][0]

        self.assertEqual(session_start["matcher"], "startup|resume")
        self.assertEqual(
            session_start["hooks"][0]["command"],
            "npx -y gh-axi",
        )

    def test_guard_redirects_raw_gh_at_shell_call_boundary(self) -> None:
        output = hook.guard_output(
            {
                "tool_name": "Bash",
                "tool_input": {
                    "command": "gh run watch 123",
                    "timeout": 30,
                },
            }
        )

        specific = output["hookSpecificOutput"]
        self.assertEqual(specific["permissionDecision"], "allow")
        self.assertEqual(specific["updatedInput"]["timeout"], 30)
        rewritten = specific["updatedInput"]["command"]
        self.assertTrue(rewritten.endswith("\ngh run watch 123"))

        with tempfile.TemporaryDirectory() as directory:
            fake_npx = Path(directory) / "npx"
            fake_npx.write_text('#!/bin/sh\nprintf "npx:%s\\n" "$*"\n')
            fake_npx.chmod(0o755)
            env = dict(os.environ, PATH=f"{directory}:{os.environ['PATH']}")
            result = subprocess.run(
                ["zsh", "-c", rewritten],
                check=True,
                capture_output=True,
                text=True,
                env=env,
            )

        self.assertEqual(result.stdout, "npx:-y gh-axi run watch 123\n")

    def test_guard_redirects_raw_gh_inside_command_substitution(self) -> None:
        output = hook.guard_output(
            {
                "tool_name": "Bash",
                "tool_input": {"command": "result=$(gh pr checks 42)"},
            }
        )

        self.assertEqual(
            output["hookSpecificOutput"]["permissionDecision"],
            "allow",
        )
        self.assertTrue(
            output["hookSpecificOutput"]["updatedInput"]["command"].endswith(
                "\nresult=$(gh pr checks 42)"
            )
        )

    def test_guard_denies_shell_forms_that_bypass_the_redirect(self) -> None:
        commands = (
            "env GH_TOKEN=secret gh run view 123",
            "/opt/homebrew/bin/gh workflow run validate.yml",
        )

        for command in commands:
            with self.subTest(command=command):
                output = hook.guard_output(
                    {"tool_name": "Bash", "tool_input": {"command": command}}
                )
                self.assertEqual(
                    output["hookSpecificOutput"]["permissionDecision"],
                    "deny",
                )

    def test_guard_denies_github_mcp(self) -> None:
        output = hook.guard_output(
            {
                "tool_name": "mcp__codex_apps__github_get_workflow_run",
                "tool_input": {"run_id": 123},
            }
        )

        self.assertEqual(output["hookSpecificOutput"]["permissionDecision"], "deny")

    def test_guard_allows_gh_axi_and_unrelated_shell(self) -> None:
        for command in ("npx -y gh-axi run view 123", "git status --short"):
            with self.subTest(command=command):
                output = hook.guard_output(
                    {"tool_name": "Bash", "tool_input": {"command": command}}
                )
                self.assertEqual(
                    output["hookSpecificOutput"]["permissionDecision"],
                    "allow",
                )
                self.assertTrue(
                    output["hookSpecificOutput"]["updatedInput"]["command"].endswith(
                        f"\n{command}"
                    )
                )

    def test_stop_allows_idle_turn_to_finish(self) -> None:
        fake = FakeCli([hook.CliResult(0, {"state": "idle"})])

        output = hook.stop_output(Path("/repo"), fake)

        self.assertIsNone(output)
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
