import json
import subprocess
from pathlib import Path

FILTER = Path(__file__).resolve().parents[1] / "attempt-signals.jq"


def test_cancelled_retry_keeps_spent_work_and_missing_times() -> None:
    start = "2026-11-03T01:00:00Z"
    end = "2026-11-03T01:00:10Z"
    step = {"name": "assemble", "conclusion": "cancelled", "startedAt": start, "completedAt": end}
    job = {
        "name": "linux",
        "conclusion": "cancelled",
        "startedAt": start,
        "completedAt": end,
        "steps": [step],
    }
    report = {
        "status": "completed",
        "attempt": 2,
        "createdAt": "2026-11-03T00:00:00Z",
        "startedAt": start,
        "updatedAt": end,
        "jobs": [job, {"conclusion": "skipped"}],
    }

    def measure() -> dict[str, object]:
        result = subprocess.run(
            ["jq", "-f", FILTER],
            input=json.dumps(report),
            text=True,
            capture_output=True,
            check=True,
        )
        return json.loads(result.stdout)

    signal = measure()
    assert signal["jobExecutionSeconds"] == 10
    assert signal["attemptWallSeconds"] == 10
    assert signal["sinceRunCreatedSeconds"] == 3610
    assert signal["firstUnsuccessfulStep"] == {
        "job": "linux",
        "step": "assemble",
        "conclusion": "cancelled",
        "url": None,
        "completedAt": end,
        "elapsedSeconds": 10,
    }
    del job["startedAt"]
    assert measure()["jobExecutionSeconds"] is None
