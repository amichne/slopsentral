from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Sequence


SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))

import ci_actions_observer as observer  # noqa: E402


RUN_IN_PROGRESS_TOON = """\
run:
  id: 123
  title: Validate change
  status: in_progress
  conclusion: null
  workflow: Validate Source
  branch: feature/example
  created: 1m ago
jobs[2]{id,name,status,conclusion}:
  10,test,in_progress,null
  11,lint,completed,success
help[1]:
  Run `gh-axi run view 123 --log-failed` to inspect failures
"""

RUN_SUCCESS_TOON = """\
run:
  id: 123
  title: Validate change
  status: completed
  conclusion: success
  workflow: Validate Source
  branch: feature/example
  created: 2m ago
jobs[1]{id,name,status,conclusion}:
  10,test,completed,success
"""

PR_PENDING_TOON = """\
summary: "1 passed, 0 failed, 1 pending, 2 total"
checks[2]{name,conclusion}:
  lint,pass
  test,pending
help[1]:
  Run `gh-axi pr view 42` to see PR details
"""

PR_FAILED_TOON = """\
summary: "1 passed, 1 failed, 2 total"
checks[2]{name,conclusion}:
  lint,pass
  test,fail
"""

RUN_API_TOON = """\
id: 123
name: Validate Source
head_branch: feature/example
status: completed
conclusion: success
event: pull_request
created_at: "2026-07-08T23:29:53Z"
updated_at: "2026-07-08T23:30:06Z"
run_attempt: 2
run_started_at: "2026-07-08T23:29:53Z"
repository:
  full_name: amichne/slopsentral
"""


class RecordingRunner:
    def __init__(self, responses: list[observer.AxiResult]):
        self.responses = list(responses)
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, args: Sequence[str], cwd: Path) -> observer.AxiResult:
        self.calls.append(tuple(args))
        if not self.responses:
            raise AssertionError(f"unexpected gh-axi call: {tuple(args)}")
        return self.responses.pop(0)


class CiActionsObservationTests(unittest.TestCase):
    def test_run_observation_uses_only_gh_axi_and_parses_jobs(self) -> None:
        runner = RecordingRunner([observer.AxiResult(0, RUN_IN_PROGRESS_TOON, "")])

        snapshot = observer.fetch_snapshot(
            observer.Target(observer.TargetKind.RUN, "123"),
            Path("."),
            runner,
        )

        self.assertEqual(snapshot.outcome, observer.Outcome.PENDING)
        self.assertEqual(snapshot.status, "in_progress")
        self.assertEqual(snapshot.details["jobs"][0]["name"], "test")
        self.assertEqual(runner.calls[0][:3], ("npx", "-y", "gh-axi"))
        self.assertNotIn("help", snapshot.details)

    def test_run_observation_classifies_terminal_success(self) -> None:
        snapshot = observer.parse_run_view(RUN_SUCCESS_TOON, "123")

        self.assertEqual(snapshot.outcome, observer.Outcome.SUCCESS)
        self.assertEqual(snapshot.conclusion, "success")
        self.assertIn("Validate Source", snapshot.summary)

    def test_pr_observation_classifies_pending_and_failure(self) -> None:
        pending = observer.parse_pr_checks(PR_PENDING_TOON, "42")
        failed = observer.parse_pr_checks(PR_FAILED_TOON, "42")

        self.assertEqual(pending.outcome, observer.Outcome.PENDING)
        self.assertEqual(pending.details["counts"]["pending"], 1)
        self.assertEqual(failed.outcome, observer.Outcome.FAILURE)
        self.assertEqual(failed.details["checks"][1]["name"], "test")

    def test_run_api_parser_returns_exact_duration_fields(self) -> None:
        details = observer.parse_run_api(RUN_API_TOON)

        self.assertEqual(details["workflow"], "Validate Source")
        self.assertEqual(details["attempt"], 2)
        self.assertEqual(details["runStartedAt"], "2026-07-08T23:29:53Z")
        self.assertEqual(details["updatedAt"], "2026-07-08T23:30:06Z")

    def test_state_key_ignores_relative_created_text_and_help_hints(self) -> None:
        first = observer.parse_run_view(RUN_IN_PROGRESS_TOON, "123")
        second = observer.parse_run_view(
            RUN_IN_PROGRESS_TOON.replace("created: 1m ago", "created: 2m ago")
            .replace("inspect failures", "read more"),
            "123",
        )

        self.assertEqual(first.state_key, second.state_key)

    def test_missing_required_run_fields_fail_closed(self) -> None:
        with self.assertRaisesRegex(observer.ObserverError, "status"):
            observer.parse_run_view("run:\n  id: 123\n", "123")


if __name__ == "__main__":
    unittest.main()
