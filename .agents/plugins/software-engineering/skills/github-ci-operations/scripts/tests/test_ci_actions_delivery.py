from __future__ import annotations

import dataclasses
import json
from pathlib import Path
from typing import Sequence

import pytest

from .test_ci_wait_for_actions import ManualClock, RecordingRunner, active_request, cli, observer


HEAD = "a" * 40
OTHER_HEAD = "b" * 40
CHECKS = json.dumps([{"name": "test", "state": "SUCCESS", "bucket": "pass"}])


def reply(value: object) -> observer.CommandResult:
    return observer.CommandResult(0, json.dumps(value), "")


class PrRunner:
    def __init__(self, heads: list[str], checks: str = CHECKS) -> None:
        self.heads = list(heads)
        self.checks = checks
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, args: Sequence[str], cwd: Path) -> observer.CommandResult:
        self.calls.append(tuple(args))
        if args[:3] == ["gh", "pr", "view"]:
            assert self.heads, "unexpected head read"
            return reply({"headRefOid": self.heads.pop(0)})
        assert args[:3] == ["gh", "pr", "checks"]
        return observer.CommandResult(0, self.checks, "")


def test_pr_snapshot_binds_current_head_by_default() -> None:
    runner = PrRunner([HEAD, HEAD])
    snapshot = observer.fetch_snapshot(
        observer.Target(observer.TargetKind.PR, "42"), Path("."), runner
    )
    assert observer.target_to_json(snapshot.target)["headSha"] == HEAD
    assert snapshot.outcome == observer.Outcome.SUCCESS
    assert len(runner.calls) == 3
    assert runner.heads == []


def test_empty_pr_checks_cannot_complete_observation() -> None:
    runner = PrRunner([HEAD, HEAD], "[]")
    snapshot = observer.fetch_snapshot(
        observer.Target(observer.TargetKind.PR, "42"), Path("."), runner
    )
    assert snapshot.outcome == observer.Outcome.PENDING
    assert snapshot.status == "awaiting_checks"


def test_head_change_during_check_read_rejects_success() -> None:
    runner = PrRunner([HEAD, OTHER_HEAD])
    with pytest.raises(observer.ObserverError, match="head changed"):
        observer.fetch_snapshot(observer.Target(observer.TargetKind.PR, "42"), Path("."), runner)


def test_changed_pinned_head_rejects_before_reading_checks() -> None:
    pinned = observer.fetch_snapshot(
        observer.Target(observer.TargetKind.PR, "42"), Path("."), PrRunner([HEAD, HEAD])
    )
    runner = PrRunner([OTHER_HEAD])
    with pytest.raises(observer.ObserverError, match="head changed"):
        observer.fetch_snapshot(pinned.target, Path("."), runner)
    assert len(runner.calls) == 1


def test_expected_head_rejection_does_not_arm(tmp_path: Path) -> None:
    store = observer.StateStore(tmp_path, state_dir=tmp_path / "state")
    runner = PrRunner([OTHER_HEAD])
    result = cli.execute(
        ["arm", "--pr", "42", "--head-sha", HEAD, "--json"], store=store, runner=runner
    )
    assert result.exit_code == 2
    assert "head changed" in result.payload["error"]
    assert store.load_active() is None


def test_timeout_keeps_request_and_resume_keeps_target(tmp_path: Path) -> None:
    clock = ManualClock(1783684800)
    store = observer.StateStore(tmp_path, state_dir=tmp_path / "state")
    baseline = observer.fetch_snapshot(
        observer.Target(observer.TargetKind.PR, "42"), tmp_path, PrRunner([HEAD, HEAD], "[]")
    )
    request = dataclasses.replace(
        active_request(baseline, expires_at=observer.iso_from_epoch(clock.time())),
        predicate=observer.WaitPredicate.TERMINAL,
    )
    store.arm(request)
    result = cli.execute(
        ["await", "--json"],
        store=store,
        runner=PrRunner([HEAD, HEAD], "[]"),
        now_epoch=clock.time,
        sleeper=clock.sleep,
    )
    assert result.exit_code == 124
    assert store.load_active() == request
    evidence = store.last_observation_path.read_bytes()
    resumed = cli.execute(
        ["resume", "--timeout", "30", "--json"],
        store=store,
        runner=RecordingRunner([]),
        now_epoch=clock.time,
    )
    assert resumed.exit_code == 0
    renewed = store.load_active()
    assert renewed is not None
    assert renewed.target == request.target
    assert renewed.baseline == request.baseline
    assert renewed.predicate == request.predicate
    assert renewed.expires_at == observer.iso_from_epoch(clock.time() + 30)
    assert store.last_observation_path.read_bytes() == evidence
    final = cli.execute(
        ["await", "--json"],
        store=store,
        runner=PrRunner([HEAD, HEAD]),
        now_epoch=clock.time,
        sleeper=clock.sleep,
    )
    assert final.exit_code == 0
    assert final.payload["outcome"] == "success"
    assert store.load_active() is None


def test_resume_requires_an_expired_request(tmp_path: Path) -> None:
    clock = ManualClock(1783684800)
    store = observer.StateStore(tmp_path, state_dir=tmp_path / "state")
    result = cli.execute(
        ["resume", "--timeout", "30"], store=store, runner=RecordingRunner([]), now_epoch=clock.time
    )
    assert result.exit_code == 2
    assert "no GitHub" in result.payload["error"]
    baseline = observer.fetch_snapshot(
        observer.Target(observer.TargetKind.PR, "42"), tmp_path, PrRunner([HEAD, HEAD], "[]")
    )
    request = active_request(baseline, expires_at=observer.iso_from_epoch(clock.time() + 300))
    store.arm(request)
    result = cli.execute(
        ["resume", "--timeout", "30"], store=store, runner=RecordingRunner([]), now_epoch=clock.time
    )
    assert result.exit_code == 2
    assert "not expired" in result.payload["error"]
    assert store.load_active() == request


def test_resumed_request_rejects_a_new_head(tmp_path: Path) -> None:
    clock = ManualClock(1783684800)
    store = observer.StateStore(tmp_path, state_dir=tmp_path / "state")
    baseline = observer.fetch_snapshot(
        observer.Target(observer.TargetKind.PR, "42"), tmp_path, PrRunner([HEAD, HEAD], "[]")
    )
    request = active_request(baseline, expires_at=observer.iso_from_epoch(clock.time()))
    store.arm(request)
    assert (
        cli.execute(["resume", "--timeout", "30"], store=store, now_epoch=clock.time).exit_code == 0
    )
    result = cli.execute(
        ["await"],
        store=store,
        runner=PrRunner([OTHER_HEAD]),
        now_epoch=clock.time,
        sleeper=clock.sleep,
    )
    assert result.exit_code == 2
    assert result.payload["target"]["headSha"] == HEAD
    assert "head changed" in result.payload["error"]
    assert store.load_active() is None


@pytest.mark.parametrize("value", ["", "abc", "A" * 40, "g" * 40])
def test_head_parser_rejects_non_commit_values(value: str) -> None:
    with pytest.raises(observer.ObserverError, match="full lowercase|missing headRefOid"):
        observer.fetch_snapshot(
            observer.Target(observer.TargetKind.PR, "42"), Path("."), PrRunner([value])
        )


def test_unbound_legacy_pr_request_is_not_trusted(tmp_path: Path) -> None:
    store = observer.StateStore(tmp_path, state_dir=tmp_path / "state")
    baseline = observer.fetch_snapshot(
        observer.Target(observer.TargetKind.PR, "42"), tmp_path, PrRunner([HEAD, HEAD], "[]")
    )
    store.arm(active_request(baseline, expires_at="2026-07-10T12:01:00Z"))
    payload = json.loads(store.active_path.read_text())
    del payload["target"]["headSha"]
    del payload["baseline"]["target"]["headSha"]
    store.active_path.write_text(json.dumps(payload))
    with pytest.raises(observer.ObserverError, match="corrupt"):
        store.load_active()
    assert not store.active_path.exists()


def test_run_target_rejects_pr_head_option(tmp_path: Path) -> None:
    result = cli.execute(
        ["arm", "--run-id", "123", "--head-sha", HEAD],
        store=observer.StateStore(tmp_path, state_dir=tmp_path / "state"),
        runner=RecordingRunner([]),
    )
    assert result.exit_code == 2
    assert "only be used with --pr" in result.payload["error"]


@pytest.mark.parametrize("changed_head", [False, True])
def test_actual_cli_across_processes(tmp_path: Path, changed_head: bool) -> None:
    import os
    import subprocess
    import sys

    from .test_ci_wait_for_actions import CLI_SCRIPT

    repo = tmp_path / "repo with spaces;literal"
    repo.mkdir()
    subprocess.run(["git", "init", str(repo)], check=True, capture_output=True, timeout=10)
    fixture = tmp_path / "fixture.json"
    log = tmp_path / "calls.jsonl"
    binary = tmp_path / "gh"
    binary.write_text(
        f"#!{sys.executable}\n"
        "import json, os, pathlib, sys\n"
        "data = json.loads(pathlib.Path(os.environ['CI_FAKE_DATA']).read_text())\n"
        "with pathlib.Path(os.environ['CI_FAKE_LOG']).open('a') as stream:\n"
        "    stream.write(json.dumps(sys.argv[1:]) + '\\n')\n"
        "if sys.argv[1:3] == ['pr', 'view']:\n"
        "    print(json.dumps({'headRefOid': data['head']}))\n"
        "elif sys.argv[1:3] == ['pr', 'checks']:\n"
        "    print(json.dumps(data['checks']))\n"
        "else:\n"
        "    sys.exit(91)\n"
    )
    binary.chmod(0o755)
    env = {
        **os.environ,
        "PATH": str(tmp_path) + os.pathsep + os.environ["PATH"],
        "CI_FAKE_DATA": str(fixture),
        "CI_FAKE_LOG": str(log),
    }

    def invoke(*args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(CLI_SCRIPT), "--repo", str(repo), *args, "--json"],
            env=env,
            capture_output=True,
            text=True,
            timeout=10,
        )

    fixture.write_text(json.dumps({"head": HEAD, "checks": []}))
    armed = invoke("arm", "--pr", "42", "--timeout", "30")
    assert armed.returncode == 0, armed.stderr
    assert json.loads(armed.stdout)["request"]["target"]["headSha"] == HEAD
    assert len(log.read_text().splitlines()) == 3
    local = invoke("status")
    assert local.returncode == 0
    assert json.loads(local.stdout)["state"] == "armed"
    assert len(log.read_text().splitlines()) == 3
    fixture.write_text(
        json.dumps({"head": OTHER_HEAD if changed_head else HEAD, "checks": json.loads(CHECKS)})
    )
    result = invoke("await")
    assert result.returncode == (2 if changed_head else 0), result.stderr
    payload = json.loads(result.stderr if changed_head else result.stdout)
    assert payload["outcome"] == ("error" if changed_head else "success")
    assert payload["target"]["headSha"] == HEAD
    assert json.loads(invoke("status").stdout)["state"] == "idle"
    assert len(log.read_text().splitlines()) == (4 if changed_head else 6)


def test_legacy_run_state_key_still_loads(tmp_path: Path) -> None:
    from .test_ci_wait_for_actions import RUN_IN_PROGRESS_JSON

    store = observer.StateStore(tmp_path, state_dir=tmp_path / "state")
    snapshot = observer.parse_run_view(RUN_IN_PROGRESS_JSON, "123")
    request = active_request(snapshot, expires_at="2026-07-10T12:01:00Z")
    payload = observer.active_request_to_json(request)
    payload["baseline"]["stateKey"] = json.dumps(
        {
            "target": {"kind": "RUN", "value": "123", "required": False},
            "status": snapshot.status,
            "conclusion": snapshot.conclusion,
            "details": snapshot.details,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    store.state_dir.mkdir()
    store.active_path.write_text(json.dumps(payload))
    assert store.load_active() == request


@pytest.mark.parametrize(
    ("bucket", "state", "outcome"),
    [
        ("cancel", "CANCELLED", observer.Outcome.FAILURE),
        ("fail", "FAILURE", observer.Outcome.FAILURE),
        ("skipping", "SKIPPED", observer.Outcome.SUCCESS),
        ("pending", "PENDING", observer.Outcome.PENDING),
    ],
)
def test_pinned_pr_keeps_check_outcomes(bucket: str, state: str, outcome: observer.Outcome) -> None:
    checks = json.dumps([{"name": "test", "bucket": bucket, "state": state}])
    snapshot = observer.fetch_snapshot(
        observer.Target(observer.TargetKind.PR, "42", head=observer.Commit(HEAD)),
        Path("."),
        PrRunner([HEAD, HEAD], checks),
    )
    assert snapshot.outcome == outcome
    assert snapshot.target.head == observer.Commit(HEAD)
