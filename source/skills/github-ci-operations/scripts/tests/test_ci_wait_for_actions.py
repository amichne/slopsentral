from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
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


class CiActionsStateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.repo_root = Path(self.temporary.name)
        self.state_dir = self.repo_root / "git-state" / "axi" / "github-actions"
        self.store = observer.StateStore(self.repo_root, state_dir=self.state_dir)
        self.baseline = observer.parse_run_view(RUN_IN_PROGRESS_TOON, "123")
        self.request = observer.ActiveRequest(
            target=self.baseline.target,
            predicate=observer.WaitPredicate.STATUS_CHANGE,
            baseline=self.baseline,
            timeout=observer.TimeoutRecommendation(
                seconds=900,
                source="default",
                sample_count=0,
                p50_seconds=None,
                p95_seconds=None,
                maximum_seconds=None,
            ),
            armed_at="2026-07-10T12:00:00Z",
            expires_at="2026-07-10T12:15:00Z",
        )

    def test_state_store_refuses_to_replace_active_request(self) -> None:
        self.store.arm(self.request)

        with self.assertRaisesRegex(observer.ObserverError, "already active"):
            self.store.arm(self.request)

        loaded = self.store.load_active()
        self.assertEqual(loaded, self.request)
        self.assertTrue(self.store.active_path.is_file())

    def test_state_directory_uses_git_rev_parse_path(self) -> None:
        calls: list[tuple[str, ...]] = []

        def fake_git(args: Sequence[str], cwd: Path) -> observer.AxiResult:
            calls.append(tuple(args))
            return observer.AxiResult(0, ".git/worktrees/topic/axi/github-actions\n", "")

        resolved = observer.resolve_state_dir(self.repo_root, fake_git)

        self.assertEqual(
            resolved,
            (self.repo_root / ".git/worktrees/topic/axi/github-actions").resolve(),
        )
        self.assertEqual(calls, [("git", "rev-parse", "--git-path", "axi/github-actions")])

    def test_auto_timeout_uses_p95_profile_with_bounds(self) -> None:
        recommendation = observer.recommend_timeout(
            [100, 120, 130, 140, 200], source="team-profile"
        )

        self.assertEqual(recommendation.sample_count, 5)
        self.assertEqual(recommendation.source, "team-profile")
        self.assertEqual(recommendation.p50_seconds, 130)
        self.assertEqual(recommendation.p95_seconds, 200)
        self.assertEqual(recommendation.seconds, 360)

    def test_auto_timeout_uses_sparse_history_and_default(self) -> None:
        sparse = observer.recommend_timeout([100, 200], source="local-history")
        empty = observer.recommend_timeout([], source="default")

        self.assertEqual(sparse.seconds, 460)
        self.assertEqual(empty.seconds, 1800)

    def test_cancelled_samples_do_not_influence_timeout(self) -> None:
        samples = [
            duration_sample(200, "success"),
            duration_sample(3000, "cancelled"),
            duration_sample(120, "failure"),
            duration_sample(2500, "startup_failure"),
        ]

        self.assertEqual(observer.eligible_durations(samples), [200, 120])

    def test_corrupt_active_state_is_quarantined(self) -> None:
        self.store.active_path.parent.mkdir(parents=True, exist_ok=True)
        self.store.active_path.write_text("{not-json", encoding="utf-8")

        with self.assertRaisesRegex(observer.ObserverError, "corrupt"):
            self.store.load_active()

        quarantined = list(self.store.active_path.parent.glob("active.corrupt-*.json"))
        self.assertEqual(len(quarantined), 1)
        self.assertFalse(self.store.active_path.exists())

    def test_profile_export_is_sorted_and_deterministic(self) -> None:
        self.store.append_duration(duration_sample(200, "success", workflow="Zeta"))
        self.store.append_duration(duration_sample(100, "success", workflow="Alpha"))
        output = self.repo_root / ".axi" / "github-actions-duration-profile.json"

        first = self.store.export_profile(output)
        second = self.store.export_profile(output)

        self.assertEqual(first, second)
        self.assertEqual([group["workflow"] for group in first["groups"]], ["Alpha", "Zeta"])
        self.assertEqual(json.loads(output.read_text(encoding="utf-8")), first)


def duration_sample(
    duration_seconds: int,
    conclusion: str,
    *,
    workflow: str = "Validate Source",
) -> observer.DurationSample:
    return observer.DurationSample(
        repository="amichne/slopsentral",
        workflow=workflow,
        event="pull_request",
        run_id="123",
        attempt=1,
        conclusion=conclusion,
        run_started_at="2026-07-08T23:29:53Z",
        updated_at="2026-07-08T23:30:06Z",
        duration_seconds=duration_seconds,
        observed_at=datetime(2026, 7, 10, 12, tzinfo=timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
    )


if __name__ == "__main__":
    unittest.main()
