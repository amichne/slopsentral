from __future__ import annotations

import dataclasses
import json
from pathlib import Path
from typing import Any

from ci_actions_duration import build_duration_profile, utc_now
from ci_actions_json import (
    active_request_from_json,
    active_request_to_json,
    duration_sample_from_json,
    wait_result_to_json,
)
from ci_actions_process import require_success, run_gh_axi
from ci_actions_types import (
    STATE_VERSION,
    ActiveRequest,
    AxiRunner,
    DurationSample,
    ObserverError,
    WaitResult,
)


def resolve_state_dir(
    repo_root: Path,
    git_runner: AxiRunner = run_gh_axi,
) -> Path:
    result = git_runner(
        ["git", "rev-parse", "--git-path", "axi/github-actions"],
        repo_root,
    )
    require_success(result, "git rev-parse --git-path")
    raw_path = result.stdout.strip()
    if not raw_path:
        raise ObserverError("git rev-parse --git-path returned an empty path")
    state_path = Path(raw_path)
    if not state_path.is_absolute():
        state_path = repo_root / state_path
    return state_path.resolve()


class StateStore:
    def __init__(
        self,
        repo_root: Path,
        *,
        state_dir: Path | None = None,
        git_runner: AxiRunner = run_gh_axi,
    ) -> None:
        self.repo_root = repo_root.resolve()
        self.state_dir = (state_dir or resolve_state_dir(self.repo_root, git_runner)).resolve()
        self.active_path = self.state_dir / "active.json"
        self.last_observation_path = self.state_dir / "last-observation.json"
        self.history_path = self.state_dir / "history.jsonl"

    def arm(self, request: ActiveRequest) -> None:
        if self.active_path.exists():
            raise ObserverError(f"an observation is already active: {self.active_path}")
        self._write_json(self.active_path, active_request_to_json(request))

    def load_active(self) -> ActiveRequest | None:
        if not self.active_path.exists():
            return None
        payload = self._load_json(self.active_path)
        try:
            return active_request_from_json(payload)
        except (KeyError, TypeError, ValueError, ObserverError) as exc:
            quarantined = self._quarantine(self.active_path)
            raise ObserverError(f"active observation state is corrupt: {quarantined}") from exc

    def clear_active(self) -> None:
        self.active_path.unlink(missing_ok=True)

    def write_last_observation(self, result: WaitResult) -> None:
        self._write_json(self.last_observation_path, wait_result_to_json(result))

    def append_duration(self, sample: DurationSample) -> None:
        existing_samples = self.load_history()
        identity = (sample.repository, sample.run_id, sample.attempt)
        identities = {
            (existing.repository, existing.run_id, existing.attempt)
            for existing in existing_samples
        }
        if identity in identities:
            return
        self._write_history([*existing_samples, sample])

    def load_history(self) -> list[DurationSample]:
        if not self.history_path.exists():
            return []
        return self._parse_history(self.history_path.read_text(encoding="utf-8").splitlines())

    def export_profile(self, output: Path | None = None) -> dict[str, Any]:
        destination = output or self.repo_root / ".axi/github-actions-duration-profile.json"
        profile = build_duration_profile(self.load_history())
        self._write_json(destination, profile)
        return profile

    def _parse_history(self, lines: list[str]) -> list[DurationSample]:
        samples: list[DurationSample] = []
        for line_number, raw in enumerate(lines, start=1):
            if not raw.strip():
                continue
            try:
                samples.append(duration_sample_from_json(json.loads(raw)))
            except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
                raise ObserverError(
                    f"duration history is corrupt at {self.history_path}:{line_number}"
                ) from exc
        return samples

    def _write_history(self, samples: list[DurationSample]) -> None:
        lines = [
            json.dumps(
                {"schemaVersion": STATE_VERSION, **dataclasses.asdict(value)},
                sort_keys=True,
                separators=(",", ":"),
            )
            for value in samples
        ]
        self.history_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.history_path.with_name(self.history_path.name + ".tmp")
        temporary.write_text("\n".join(lines) + "\n", encoding="utf-8")
        temporary.replace(self.history_path)

    def _write_json(self, path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + ".tmp")
        temporary.write_text(
            json.dumps(payload, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)

    def _load_json(self, path: Path) -> dict[str, Any]:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            quarantined = self._quarantine(path)
            raise ObserverError(f"state file is corrupt: {quarantined}") from exc
        if not isinstance(payload, dict):
            quarantined = self._quarantine(path)
            raise ObserverError(f"state file is corrupt: {quarantined}")
        return payload

    def _quarantine(self, path: Path) -> Path:
        timestamp = utc_now().replace("-", "").replace(":", "")
        quarantined = path.with_name(f"{path.stem}.corrupt-{timestamp}{path.suffix}")
        path.replace(quarantined)
        return quarantined
