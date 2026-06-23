from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path
from typing import Any, Sequence

SCRIPT = Path(__file__).resolve().parents[1] / "ci_wait_for_actions.py"
SPEC = importlib.util.spec_from_file_location("ci_wait_for_actions", SCRIPT)
assert SPEC is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class FakeRunner:
    def __init__(self, responses: dict[tuple[str, ...], list[Any]]):
        self.responses = {key: list(value) for key, value in responses.items()}
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, args: Sequence[str], cwd: Path) -> Any:
        key = tuple(args)
        self.calls.append(key)
        values = self.responses.get(key)
        if not values:
            raise AssertionError(f"unexpected gh call: {key}")
        value = values.pop(0)
        if isinstance(value, MODULE.GhResult):
            return value
        return MODULE.GhResult(0, json.dumps(value), "")


class ManualClock:
    def __init__(self) -> None:
        self.value = 0.0

    def monotonic(self) -> float:
        return self.value

    def sleep(self, seconds: float) -> None:
        self.value += seconds


class CiWaitForActionsTests(unittest.TestCase):
    def test_run_observation_classifies_pending_success_and_failure(self) -> None:
        command = (
            "run",
            "view",
            "123",
            "--json",
            ",".join(MODULE.DEFAULT_FIELDS),
        )
        runner = FakeRunner(
            {
                command: [
                    {
                        "workflowName": "Validate",
                        "status": "in_progress",
                        "conclusion": None,
                        "jobs": [{"name": "test", "status": "in_progress"}],
                    },
                    {
                        "workflowName": "Validate",
                        "status": "completed",
                        "conclusion": "success",
                        "jobs": [
                            {
                                "name": "test",
                                "status": "completed",
                                "conclusion": "success",
                            }
                        ],
                    },
                    {
                        "workflowName": "Validate",
                        "status": "completed",
                        "conclusion": "failure",
                        "jobs": [
                            {
                                "name": "test",
                                "status": "completed",
                                "conclusion": "failure",
                            }
                        ],
                    },
                ]
            }
        )

        pending = MODULE.fetch_run_observation("123", Path("."), runner)
        success = MODULE.fetch_run_observation("123", Path("."), runner)
        failure = MODULE.fetch_run_observation("123", Path("."), runner)

        self.assertEqual(pending.outcome, "pending")
        self.assertEqual(success.outcome, "success")
        self.assertEqual(failure.outcome, "failure")
        self.assertEqual(failure.failing_run_ids, ("123",))

    def test_pr_observation_extracts_unique_failing_action_run_ids(self) -> None:
        command = (
            "pr",
            "checks",
            "42",
            "--json",
            ",".join(MODULE.CHECK_FIELDS),
        )
        runner = FakeRunner(
            {
                command: [
                    [
                        {
                            "name": "unit",
                            "bucket": "pass",
                            "state": "SUCCESS",
                            "link": "https://github.com/acme/repo/actions/runs/1/job/10",
                        },
                        {
                            "name": "integration",
                            "bucket": "fail",
                            "state": "FAILURE",
                            "link": "https://github.com/acme/repo/actions/runs/2/job/20",
                        },
                        {
                            "name": "lint",
                            "bucket": "fail",
                            "state": "FAILURE",
                            "link": "https://github.com/acme/repo/actions/runs/2/job/21",
                        },
                    ]
                ]
            }
        )

        observation = MODULE.fetch_pr_observation("42", False, Path("."), runner)

        self.assertEqual(observation.outcome, "failure")
        self.assertEqual(observation.failing_run_ids, ("2",))

    def test_wait_records_only_changed_transitions(self) -> None:
        observations = [
            MODULE.Observation("pending", "queued", "run queued", {}),
            MODULE.Observation("pending", "queued", "run queued", {}),
            MODULE.Observation("pending", "running", "run running", {}),
            MODULE.Observation("success", "passed", "run passed", {}),
        ]
        clock = ManualClock()
        emitted: list[Any] = []

        def fetch() -> Any:
            return observations.pop(0)

        result = MODULE.wait_until_terminal(
            target={"type": "RUN", "runId": "123"},
            fetch_observation=fetch,
            repo_root=Path("."),
            runner=FakeRunner({}),
            interval_seconds=5,
            max_interval_seconds=20,
            timeout_seconds=60,
            failure_log_lines=0,
            emit_transition=emitted.append,
            monotonic=clock.monotonic,
            sleeper=clock.sleep,
            now=lambda: "2026-06-22T00:00:00Z",
        )

        self.assertEqual(result.outcome, "success")
        self.assertEqual(result.polls, 4)
        self.assertEqual([transition.summary for transition in result.transitions], [
            "run queued",
            "run running",
            "run passed",
        ])
        self.assertEqual(len(emitted), 3)
        self.assertGreaterEqual(clock.value, 10)

    def test_extract_run_id_accepts_run_and_job_urls(self) -> None:
        self.assertEqual(
            MODULE.extract_run_id("https://github.com/acme/repo/actions/runs/123/job/456"),
            "123",
        )
        self.assertEqual(MODULE.extract_run_id("https://github.com/acme/repo/runs/789"), "789")
        self.assertIsNone(MODULE.extract_run_id("https://example.com"))


if __name__ == "__main__":
    unittest.main()
