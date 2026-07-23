#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: run_gradle_task.sh --repo PATH --task TASK [--log-dir PATH] [--] [GRADLE_ARGS...]

Runs a Gradle task and writes structured JSON evidence to stdout. Raw Gradle
output is written to a log file.
USAGE
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 2
}

repo_arg="."
task_name=""
log_dir_arg=""
extra_args=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      [[ $# -ge 2 ]] || die "--repo requires a path"
      repo_arg="$2"
      shift 2
      ;;
    --task)
      [[ $# -ge 2 ]] || die "--task requires a Gradle task"
      task_name="$2"
      shift 2
      ;;
    --log-dir)
      [[ $# -ge 2 ]] || die "--log-dir requires a path"
      log_dir_arg="$2"
      shift 2
      ;;
    --)
      shift
      extra_args=("$@")
      break
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      extra_args+=("$1")
      shift
      ;;
  esac
done

[[ -n "$task_name" ]] || die "--task is required"

if repo_root="$(git -C "$repo_arg" rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  [[ -d "$repo_arg" ]] || die "repository path is not a directory: $repo_arg"
  repo_root="$(cd "$repo_arg" && pwd)"
fi

command -v python3 >/dev/null 2>&1 || die "python3 is required"

if [[ -x "$repo_root/gradlew" ]]; then
  gradle_cmd=("$repo_root/gradlew")
elif command -v gradle >/dev/null 2>&1; then
  gradle_cmd=("$(command -v gradle)")
else
  die "no executable Gradle wrapper or gradle binary found"
fi

if [[ -n "$log_dir_arg" ]]; then
  log_dir="$log_dir_arg"
else
  log_dir="$repo_root/.agent-turn/kotlin-gradle-validation/logs"
fi
mkdir -p -- "$log_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
safe_task="$(
  TASK_NAME="$task_name" python3 - <<'PY'
import os
import re

value = os.environ["TASK_NAME"]
slug = re.sub(r"[^A-Za-z0-9_.-]+", "_", value).strip("._")
print(slug or "gradle")
PY
)"
log_file="$log_dir/${timestamp}-${safe_task}.log"

args=("${gradle_cmd[@]}" "--no-daemon" "--console=plain" "$task_name" "${extra_args[@]}")
start_ms="$(python3 - <<'PY'
import time

print(int(time.time() * 1000))
PY
)"

set +e
(
  cd "$repo_root"
  "${args[@]}"
) >"$log_file" 2>&1
status=$?
set -e

end_ms="$(python3 - <<'PY'
import time

print(int(time.time() * 1000))
PY
)"
duration_ms=$((end_ms - start_ms))

RUNNER_REPO_ROOT="$repo_root" \
RUNNER_TASK_NAME="$task_name" \
RUNNER_LOG_FILE="$log_file" \
RUNNER_EXIT_CODE="$status" \
RUNNER_DURATION_MS="$duration_ms" \
RUNNER_GRADLE_BIN="${gradle_cmd[0]}" \
RUNNER_EXTRA_ARGS_JSON="$(
  python3 - "${extra_args[@]}" <<'PY'
import json
import sys

print(json.dumps(sys.argv[1:]))
PY
)" \
python3 - <<'PY'
from __future__ import annotations

import json
import os
import re
from pathlib import Path

log_path = Path(os.environ["RUNNER_LOG_FILE"])
text = log_path.read_text(encoding="utf-8", errors="replace") if log_path.exists() else ""
exit_code = int(os.environ["RUNNER_EXIT_CODE"])
tasks_executed = len(re.findall(r"^> Task ", text, flags=re.MULTILINE))
tasks_up_to_date = len(re.findall(r"UP-TO-DATE$", text, flags=re.MULTILINE))
tasks_from_cache = len(re.findall(r"FROM-CACHE$", text, flags=re.MULTILINE))
build_successful = "BUILD SUCCESSFUL" in text and exit_code == 0
failure_summary = None
if exit_code != 0:
    diagnostics = re.findall(r"(?m)^e: .+$", text)
    failure = re.search(r"(?ms)^FAILURE:.*?(?:^BUILD FAILED.*?$|\\Z)", text)
    parts = diagnostics[:3]
    if failure:
        parts.append(" ".join(failure.group(0).split()))
    else:
        non_empty_lines = [line.strip() for line in text.splitlines() if line.strip()]
        parts.extend(non_empty_lines[-12:])
    failure_summary = " ".join(parts)[:800]

payload = {
    "ok": exit_code == 0,
    "repoRoot": os.environ["RUNNER_REPO_ROOT"],
    "task": os.environ["RUNNER_TASK_NAME"],
    "extraArgs": json.loads(os.environ["RUNNER_EXTRA_ARGS_JSON"]),
    "exitCode": exit_code,
    "durationMs": int(os.environ["RUNNER_DURATION_MS"]),
    "gradleExecutable": os.environ["RUNNER_GRADLE_BIN"],
    "logFile": str(log_path),
    "tasksExecuted": tasks_executed,
    "tasksUpToDate": tasks_up_to_date,
    "tasksFromCache": tasks_from_cache,
    "buildSuccessful": build_successful,
    "testTaskDetected": bool(re.search(r"(?:^|:)(test|check)\b", os.environ["RUNNER_TASK_NAME"], re.I)),
    "failureSummary": failure_summary,
}
print(json.dumps(payload, indent=2, sort_keys=True))
PY

exit "$status"
