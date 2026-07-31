"""Stable public facade for the GitHub Actions observer."""

from ci_actions_duration import (
    duration_sample_from_run_api,
    eligible_durations,
    iso_from_epoch,
    parse_utc,
    percentile,
    recommend_timeout,
    record_terminal_duration,
    utc_now,
)
from ci_actions_profile import build_duration_profile
from ci_actions_json import (
    active_request_from_json,
    active_request_to_json,
    duration_sample_from_json,
    optional_int,
    required_mapping,
    snapshot_from_json,
    snapshot_to_json,
    target_from_json,
    target_to_json,
    wait_result_to_json,
)
from ci_actions_pr_summary import count_checks, parse_check, parse_pr_checks
from ci_actions_process import (
    fetch_snapshot,
    is_transient_failure,
    no_checks,
    pr_number,
    require_success,
    resolve_repository_slug,
    run_command,
)
from ci_actions_run_parser import (
    classify_run,
    count_job_states,
    parse_run_api,
    parse_run_view,
)
from ci_actions_scalars import normalized, parse_json, required_text
from ci_actions_storage import StateStore, resolve_state_dir
from ci_actions_types import (
    CommandResult,
    CommandRunner,
    FAILURE_CONCLUSIONS,
    GH_PREFIX,
    INELIGIBLE_DURATION_CONCLUSIONS,
    STATE_VERSION,
    ActiveRequest,
    DurationSample,
    ObserverError,
    Outcome,
    Snapshot,
    Target,
    TargetKind,
    TimeoutRecommendation,
    TransientObserverError,
    WaitPredicate,
    WaitResult,
)
from ci_actions_wait import await_event, event_satisfied


__all__ = [name for name in globals() if not name.startswith("_")]
