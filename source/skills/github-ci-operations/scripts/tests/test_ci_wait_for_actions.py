from __future__ import annotations

import json
import importlib.util
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from importlib.machinery import SourceFileLoader
from pathlib import Path
from typing import Sequence


SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))

import ci_actions_observer as observer  # noqa: E402


CLI_SCRIPT = SCRIPTS / "ci_wait_for_actions"
CLI_LOADER = SourceFileLoader("ci_wait_for_actions", str(CLI_SCRIPT))
CLI_SPEC = importlib.util.spec_from_loader(CLI_LOADER.name, CLI_LOADER)
assert CLI_SPEC is not None
cli = importlib.util.module_from_spec(CLI_SPEC)
sys.modules[CLI_SPEC.name] = cli
assert CLI_SPEC.loader is not None
CLI_SPEC.loader.exec_module(cli)


SOURCE_ROOT = SCRIPTS.parents[2]
GITHUB_SURFACES = (
    SOURCE_ROOT / "skills/github-ci-operations/SKILL.md",
    SOURCE_ROOT / "skills/github-ci-operations/references/ci-failure-triage.md",
    SOURCE_ROOT / "skills/github-ci-operations/references/release-flow.md",
    SOURCE_ROOT / "skills/pull-request-lifecycle/SKILL.md",
    SOURCE_ROOT / "skills/define-goal/SKILL.md",
    SOURCE_ROOT / "evals/plugin-benchmarks/effective-delivery.json",
    SOURCE_ROOT / "evals/routing/daily-driver-workflows.json",
    SOURCE_ROOT / "evals/routing/fixtures/golden-routing-observations.json",
)


RUN_IN_PROGRESS_JSON = json.dumps(
    {
        "status": "in_progress",
        "conclusion": "",
        "workflowName": "Validate Source",
        "jobs": [
            {"name": "test", "status": "in_progress", "conclusion": ""},
            {"name": "lint", "status": "completed", "conclusion": "success"},
        ],
    }
)
RUN_SUCCESS_JSON = json.dumps(
    {
        "status": "completed",
        "conclusion": "success",
        "workflowName": "Validate Source",
        "jobs": [{"name": "test", "status": "completed", "conclusion": "success"}],
    }
)
PR_PENDING_JSON = json.dumps(
    [
        {"name": "lint", "state": "SUCCESS", "bucket": "pass"},
        {"name": "test", "state": "PENDING", "bucket": "pending"},
    ]
)
PR_FAILED_JSON = json.dumps(
    [
        {"name": "lint", "state": "SUCCESS", "bucket": "pass"},
        {"name": "test", "state": "FAILURE", "bucket": "fail"},
    ]
)
RUN_API_JSON = json.dumps(
    {
        "id": 123,
        "name": "Validate Source",
        "head_branch": "feature/example",
        "status": "completed",
        "conclusion": "success",
        "event": "pull_request",
        "created_at": "2026-07-08T23:29:53Z",
        "updated_at": "2026-07-08T23:30:06Z",
        "run_attempt": 2,
        "run_started_at": "2026-07-08T23:29:53Z",
    }
)


class RecordingRunner:
    def __init__(self, responses: list[observer.CommandResult]):
        self.responses = list(responses)
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, args: Sequence[str], cwd: Path) -> observer.CommandResult:
        self.calls.append(tuple(args))
        if not self.responses:
            raise AssertionError(f"unexpected command: {tuple(args)}")
        return self.responses.pop(0)


class ManualClock:
    def __init__(self, epoch_seconds: float) -> None:
        self.value = epoch_seconds

    def time(self) -> float:
        return self.value

    def sleep(self, seconds: float) -> None:
        self.value += seconds


class CiActionsObservationTests(unittest.TestCase):
    def test_repository_has_no_removed_github_wrapper_contract(self) -> None:
        repository_root = SOURCE_ROOT.parent
        removed_marker = "".join(("a", "x", "i"))
        removed_name = f"gh-{removed_marker}"
        removed_symbol = removed_name.replace("-", "_")
        removed_state_path = f".{removed_marker}/github-actions"
        result = subprocess.run(
            [
                "git",
                "grep",
                "-Iil",
                "-F",
                "-e",
                removed_name,
                "-e",
                removed_symbol,
                "-e",
                removed_state_path,
                "--",
                "source",
            ],
            cwd=repository_root,
            text=True,
            capture_output=True,
        )

        self.assertIn(result.returncode, (0, 1), result.stderr)
        self.assertEqual(result.stdout.strip(), "")

    def test_authored_workflows_do_not_use_removed_evidence_helper(self) -> None:
        violations: list[str] = []
        for path in GITHUB_SURFACES:
            text = path.read_text(encoding="utf-8")
            if "ci_check_evidence" in text:
                violations.append(f"{path.relative_to(SOURCE_ROOT)}: removed helper")

        self.assertEqual(violations, [])

    def test_run_observation_uses_native_gh_json_and_parses_jobs(self) -> None:
        runner = RecordingRunner([observer.CommandResult(0, RUN_IN_PROGRESS_JSON, "")])

        snapshot = observer.fetch_snapshot(
            observer.Target(observer.TargetKind.RUN, "123"),
            Path("."),
            runner,
        )

        self.assertEqual(snapshot.outcome, observer.Outcome.PENDING)
        self.assertEqual(snapshot.status, "in_progress")
        self.assertEqual(snapshot.details["jobs"][0]["name"], "test")
        self.assertEqual(
            runner.calls[0],
            (
                "gh",
                "run",
                "view",
                "123",
                "--json",
                "status,conclusion,jobs,workflowName",
            ),
        )
        self.assertNotIn("help", snapshot.details)

    def test_run_observation_classifies_terminal_success(self) -> None:
        snapshot = observer.parse_run_view(RUN_SUCCESS_JSON, "123")

        self.assertEqual(snapshot.outcome, observer.Outcome.SUCCESS)
        self.assertEqual(snapshot.conclusion, "success")
        self.assertIn("Validate Source", snapshot.summary)

    def test_pr_observation_classifies_pending_and_failure(self) -> None:
        pending = observer.parse_pr_checks(PR_PENDING_JSON, "42")
        failed = observer.parse_pr_checks(PR_FAILED_JSON, "42")

        self.assertEqual(pending.outcome, observer.Outcome.PENDING)
        self.assertEqual(pending.details["counts"]["pending"], 1)
        self.assertEqual(failed.outcome, observer.Outcome.FAILURE)
        self.assertEqual(failed.details["checks"][1]["name"], "test")

    def test_required_pr_observation_uses_native_required_filter(self) -> None:
        runner = RecordingRunner([observer.CommandResult(8, PR_PENDING_JSON, "")])

        snapshot = observer.fetch_snapshot(
            observer.Target(observer.TargetKind.PR, "42", required=True),
            Path("."),
            runner,
        )

        self.assertEqual(snapshot.outcome, observer.Outcome.PENDING)
        self.assertEqual([check["name"] for check in snapshot.details["checks"]], ["lint", "test"])
        self.assertEqual(
            runner.calls,
            [
                (
                    "gh",
                    "pr",
                    "checks",
                    "42",
                    "--json",
                    "name,state,bucket",
                    "--required",
                )
            ],
        )

    def test_pr_target_normalizes_number_and_github_url(self) -> None:
        self.assertEqual(observer.pr_number("42"), "42")
        self.assertEqual(
            observer.pr_number("https://github.com/amichne/slopsentral/pull/42"),
            "42",
        )
        with self.assertRaisesRegex(observer.ObserverError, "PR number"):
            observer.pr_number("current")

    def test_pr_observation_accepts_failed_check_json_on_exit_one(self) -> None:
        runner = RecordingRunner([observer.CommandResult(1, PR_FAILED_JSON, "")])

        snapshot = observer.fetch_snapshot(
            observer.Target(observer.TargetKind.PR, "42"),
            Path("."),
            runner,
        )

        self.assertEqual(snapshot.outcome, observer.Outcome.FAILURE)

    def test_no_required_checks_is_empty_success(self) -> None:
        runner = RecordingRunner(
            [
                observer.CommandResult(
                    1,
                    "",
                    "no required checks reported on the 'feature/example' branch\n",
                )
            ]
        )

        snapshot = observer.fetch_snapshot(
            observer.Target(observer.TargetKind.PR, "42", required=True),
            Path("."),
            runner,
        )

        self.assertEqual(snapshot.outcome, observer.Outcome.SUCCESS)
        self.assertEqual(snapshot.details["counts"]["total"], 0)

    def test_no_checks_is_empty_success(self) -> None:
        runner = RecordingRunner(
            [
                observer.CommandResult(
                    1,
                    "",
                    "no checks reported on the 'feature/example' branch\n",
                )
            ]
        )

        snapshot = observer.fetch_snapshot(
            observer.Target(observer.TargetKind.PR, "42"),
            Path("."),
            runner,
        )

        self.assertEqual(snapshot.outcome, observer.Outcome.SUCCESS)
        self.assertEqual(snapshot.details["counts"]["total"], 0)

    def test_pr_observation_preserves_transient_exit_one_error(self) -> None:
        runner = RecordingRunner(
            [observer.CommandResult(1, "", "temporary GitHub API failure")]
        )

        with self.assertRaisesRegex(
            observer.TransientObserverError,
            "temporary GitHub API failure",
        ):
            observer.fetch_snapshot(
                observer.Target(observer.TargetKind.PR, "42"),
                Path("."),
                runner,
            )

    def test_pr_observation_preserves_missing_pr_error(self) -> None:
        runner = RecordingRunner(
            [observer.CommandResult(1, "", "GraphQL: Could not resolve to a PullRequest")]
        )

        with self.assertRaisesRegex(observer.ObserverError, "Could not resolve"):
            observer.fetch_snapshot(
                observer.Target(observer.TargetKind.PR, "999999"),
                Path("."),
                runner,
            )

    def test_run_api_parser_returns_exact_duration_fields(self) -> None:
        details = observer.parse_run_api(RUN_API_JSON)

        self.assertEqual(details["workflow"], "Validate Source")
        self.assertEqual(details["attempt"], 2)
        self.assertEqual(details["runStartedAt"], "2026-07-08T23:29:53Z")
        self.assertEqual(details["updatedAt"], "2026-07-08T23:30:06Z")

    def test_state_key_ignores_unrequested_json_fields(self) -> None:
        first = observer.parse_run_view(RUN_IN_PROGRESS_JSON, "123")
        payload = json.loads(RUN_IN_PROGRESS_JSON)
        payload.update({"createdAt": "later", "help": "read more"})
        second = observer.parse_run_view(json.dumps(payload), "123")

        self.assertEqual(first.state_key, second.state_key)

    def test_missing_required_run_fields_fail_closed(self) -> None:
        with self.assertRaisesRegex(observer.ObserverError, "status"):
            observer.parse_run_view('{"jobs": []}', "123")


class CiActionsStateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.repo_root = Path(self.temporary.name)
        self.state_dir = self.repo_root / "git-state" / "ci" / "github-actions"
        self.store = observer.StateStore(self.repo_root, state_dir=self.state_dir)
        self.baseline = observer.parse_run_view(RUN_IN_PROGRESS_JSON, "123")
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

        def fake_git(args: Sequence[str], cwd: Path) -> observer.CommandResult:
            calls.append(tuple(args))
            return observer.CommandResult(0, ".git/worktrees/topic/ci/github-actions\n", "")

        resolved = observer.resolve_state_dir(self.repo_root, fake_git)

        self.assertEqual(
            resolved,
            (self.repo_root / ".git/worktrees/topic/ci/github-actions").resolve(),
        )
        self.assertEqual(calls, [("git", "rev-parse", "--git-path", "ci/github-actions")])

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
        self.store.append_duration(
            duration_sample(200, "success", workflow="Zeta", run_id="123")
        )
        self.store.append_duration(
            duration_sample(100, "success", workflow="Alpha", run_id="124")
        )
        output = self.repo_root / ".ci" / "github-actions-duration-profile.json"

        first = self.store.export_profile(output)
        second = self.store.export_profile(output)

        self.assertEqual(first, second)
        self.assertEqual([group["workflow"] for group in first["groups"]], ["Alpha", "Zeta"])
        self.assertEqual(json.loads(output.read_text(encoding="utf-8")), first)

    def test_duration_history_deduplicates_a_run_attempt(self) -> None:
        sample = duration_sample(200, "success")

        self.store.append_duration(sample)
        self.store.append_duration(sample)

        self.assertEqual(self.store.load_history(), [sample])

    def test_await_retries_two_transient_observation_errors(self) -> None:
        attempts = 0
        epoch = datetime(2026, 7, 10, 12, tzinfo=timezone.utc).timestamp()

        def fetch(_: observer.Target) -> observer.Snapshot:
            nonlocal attempts
            attempts += 1
            if attempts < 3:
                raise observer.TransientObserverError("temporary API failure")
            return observer.parse_run_view(RUN_SUCCESS_JSON, "123")

        result = observer.await_event(
            self.request,
            fetch=fetch,
            now_epoch=lambda: epoch,
            sleeper=lambda _: None,
        )

        self.assertEqual(result.outcome, observer.Outcome.SUCCESS)
        self.assertEqual(attempts, 3)

    def test_await_fails_after_three_consecutive_observation_errors(self) -> None:
        attempts = 0
        epoch = datetime(2026, 7, 10, 12, tzinfo=timezone.utc).timestamp()

        def fetch(_: observer.Target) -> observer.Snapshot:
            nonlocal attempts
            attempts += 1
            raise observer.TransientObserverError("temporary API failure")

        with self.assertRaisesRegex(observer.ObserverError, "after 3 attempts"):
            observer.await_event(
                self.request,
                fetch=fetch,
                now_epoch=lambda: epoch,
                sleeper=lambda _: None,
            )

        self.assertEqual(attempts, 3)

    def test_await_does_not_retry_validation_errors(self) -> None:
        attempts = 0

        def fetch(_: observer.Target) -> observer.Snapshot:
            nonlocal attempts
            attempts += 1
            raise observer.ObserverError("malformed GitHub JSON")

        with self.assertRaisesRegex(observer.ObserverError, "malformed GitHub JSON"):
            observer.await_event(
                self.request,
                fetch=fetch,
                now_epoch=lambda: datetime(
                    2026, 7, 10, 12, tzinfo=timezone.utc
                ).timestamp(),
                sleeper=lambda _: None,
            )

        self.assertEqual(attempts, 1)


class CiActionsCliTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.repo_root = Path(self.temporary.name)
        self.state_dir = self.repo_root / "git-state" / "ci" / "github-actions"
        self.store = observer.StateStore(self.repo_root, state_dir=self.state_dir)
        self.start_epoch = datetime(2026, 7, 10, 12, tzinfo=timezone.utc).timestamp()
        self.clock = ManualClock(self.start_epoch)

    def test_arm_records_baseline_and_resolved_timeout(self) -> None:
        runner = RecordingRunner([observer.CommandResult(0, RUN_IN_PROGRESS_JSON, "")])

        result = cli.execute(
            [
                "--repo",
                str(self.repo_root),
                "arm",
                "--run-id",
                "123",
                "--until",
                "status-change",
                "--timeout",
                "auto",
                "--json",
            ],
            runner=runner,
            store=self.store,
            now_epoch=self.clock.time,
        )

        self.assertEqual(result.exit_code, 0)
        self.assertEqual(result.payload["request"]["predicate"], "status-change")
        self.assertEqual(result.payload["timeout"]["source"], "default")
        self.assertEqual(self.store.load_active().target.value, "123")

    def test_await_emits_only_the_changed_state(self) -> None:
        request = active_request(
            observer.parse_run_view(RUN_IN_PROGRESS_JSON, "123"),
            expires_at="2026-07-10T12:01:00Z",
        )
        self.store.arm(request)
        runner = RecordingRunner(
            [
                observer.CommandResult(0, RUN_IN_PROGRESS_JSON, ""),
                observer.CommandResult(
                    0,
                    RUN_IN_PROGRESS_JSON.replace('"status": "in_progress"', '"status": "queued"', 1),
                    "",
                ),
            ]
        )

        result = cli.execute(
            ["--repo", str(self.repo_root), "await", "--json"],
            runner=runner,
            store=self.store,
            now_epoch=self.clock.time,
            sleeper=self.clock.sleep,
        )

        self.assertEqual(result.exit_code, 0)
        self.assertEqual(result.payload["outcome"], "pending")
        self.assertEqual(result.payload["polls"], 2)
        self.assertNotEqual(
            result.payload["previous"]["stateKey"],
            result.payload["current"]["stateKey"],
        )
        self.assertFalse(self.store.active_path.exists())

    def test_timeout_preserves_latest_state_and_returns_124(self) -> None:
        baseline = observer.parse_run_view(RUN_IN_PROGRESS_JSON, "123")
        self.store.arm(active_request(baseline, expires_at="2026-07-10T12:00:10Z"))
        runner = RecordingRunner(
            [observer.CommandResult(0, RUN_IN_PROGRESS_JSON, "") for _ in range(2)]
        )

        result = cli.execute(
            ["--repo", str(self.repo_root), "await", "--json"],
            runner=runner,
            store=self.store,
            now_epoch=self.clock.time,
            sleeper=self.clock.sleep,
        )

        self.assertEqual(result.exit_code, 124)
        self.assertEqual(result.payload["outcome"], "timeout")
        self.assertEqual(result.payload["current"]["stateKey"], baseline.state_key)
        self.assertFalse(self.store.active_path.exists())
        self.assertTrue(self.store.last_observation_path.exists())

    def test_await_records_error_evidence_after_retry_exhaustion(self) -> None:
        baseline = observer.parse_run_view(RUN_IN_PROGRESS_JSON, "123")
        self.store.arm(active_request(baseline, expires_at="2026-07-10T12:05:00Z"))
        runner = RecordingRunner(
            [observer.CommandResult(1, "", "temporary API failure") for _ in range(3)]
        )

        result = cli.execute(
            ["--repo", str(self.repo_root), "await", "--json"],
            runner=runner,
            store=self.store,
            now_epoch=self.clock.time,
            sleeper=self.clock.sleep,
        )

        self.assertEqual(result.exit_code, 2)
        self.assertEqual(result.payload["outcome"], "error")
        self.assertIn("after 3 attempts", result.payload["error"])
        self.assertFalse(self.store.active_path.exists())
        evidence = json.loads(self.store.last_observation_path.read_text(encoding="utf-8"))
        self.assertEqual(evidence["outcome"], "error")
        self.assertEqual(evidence["error"], result.payload["error"])

    def test_status_reports_idle_without_remote_calls(self) -> None:
        result = cli.execute(
            ["--repo", str(self.repo_root), "status", "--json"],
            runner=RecordingRunner([]),
            store=self.store,
        )

        self.assertEqual(result.exit_code, 0)
        self.assertEqual(result.payload, {"state": "idle"})


def duration_sample(
    duration_seconds: int,
    conclusion: str,
    *,
    workflow: str = "Validate Source",
    run_id: str = "123",
) -> observer.DurationSample:
    return observer.DurationSample(
        repository="amichne/slopsentral",
        workflow=workflow,
        event="pull_request",
        run_id=run_id,
        attempt=1,
        conclusion=conclusion,
        run_started_at="2026-07-08T23:29:53Z",
        updated_at="2026-07-08T23:30:06Z",
        duration_seconds=duration_seconds,
        observed_at=datetime(2026, 7, 10, 12, tzinfo=timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
    )


def active_request(
    baseline: observer.Snapshot,
    *,
    expires_at: str,
) -> observer.ActiveRequest:
    return observer.ActiveRequest(
        target=baseline.target,
        predicate=observer.WaitPredicate.STATUS_CHANGE,
        baseline=baseline,
        timeout=observer.TimeoutRecommendation(
            seconds=300,
            source="explicit",
            sample_count=0,
            p50_seconds=None,
            p95_seconds=None,
            maximum_seconds=None,
        ),
        armed_at="2026-07-10T12:00:00Z",
        expires_at=expires_at,
    )


if __name__ == "__main__":
    unittest.main()
