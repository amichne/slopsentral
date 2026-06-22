#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: gradle-check-green.sh [--repo PATH]

Runs a Gradle green check when Kotlin, Java, Gradle, or build-logic files changed.

Environment:
  INTELLIGENCE_CHANGED_FILES     Optional changed-file list, separated by newlines or commas.
  INTELLIGENCE_GRADLE_CHECK      Gradle task list to run. Defaults to "check"; set to "off" to skip.
  INTELLIGENCE_GRADLE_LOG_DIR    Log directory. Defaults to .agent-turn/gradle-check-green.
USAGE
}

die() {
  printf 'gradle-check-green: error: %s\n' "$*" >&2
  exit 2
}

repo_arg="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      [[ $# -ge 2 ]] || die "--repo requires a path"
      repo_arg="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if repo_root="$(git -C "$repo_arg" rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  repo_root="$(cd "$repo_arg" && pwd)"
fi

check_spec="${INTELLIGENCE_GRADLE_CHECK:-check}"
if [[ "$check_spec" == "off" || "$check_spec" == "skip" ]]; then
  echo "gradle-check-green: skipped by INTELLIGENCE_GRADLE_CHECK=$check_spec"
  exit 0
fi

if [[ ! -x "$repo_root/gradlew" ]]; then
  echo "gradle-check-green: no executable Gradle wrapper found; skipping"
  exit 0
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
runner="$script_dir/../skills/kotlin-gradle-validation/scripts/run_gradle_task.sh"
[[ -x "$runner" ]] || die "missing executable Gradle validation runner: $runner"

changed_files() {
  if [[ -n "${INTELLIGENCE_CHANGED_FILES:-}" ]]; then
    printf '%s\n' "$INTELLIGENCE_CHANGED_FILES" | tr ',' '\n' | sed '/^$/d'
    return
  fi

  if git -C "$repo_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    {
      git -C "$repo_root" diff --name-only HEAD -- 2>/dev/null || true
      git -C "$repo_root" diff --name-only --cached -- 2>/dev/null || true
      git -C "$repo_root" ls-files --others --exclude-standard 2>/dev/null || true
    } | sed '/^$/d' | sort -u
  fi
}

needs_gradle_check="false"
while IFS= read -r changed_file || [[ -n "$changed_file" ]]; do
  case "$changed_file" in
    *.kt|*.kts|*.java|build.gradle|build.gradle.kts|settings.gradle|settings.gradle.kts|gradle.properties|gradlew|gradlew.bat|gradle/*|gradle/**|build-logic/*|build-logic/**)
      needs_gradle_check="true"
      break
      ;;
  esac
done < <(changed_files)

if [[ "$needs_gradle_check" != "true" ]]; then
  echo "gradle-check-green: no Kotlin or Gradle-owned changes detected"
  exit 0
fi

read -r -a gradle_args <<<"$check_spec"
if [[ "${#gradle_args[@]}" -eq 0 ]]; then
  echo "gradle-check-green: INTELLIGENCE_GRADLE_CHECK produced no Gradle task" >&2
  exit 2
fi

log_dir="${INTELLIGENCE_GRADLE_LOG_DIR:-$repo_root/.agent-turn/gradle-check-green}"
mkdir -p "$log_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
safe_spec="$(printf '%s' "$check_spec" | tr -c 'A-Za-z0-9_.-' '_')"
evidence_file="$log_dir/${timestamp}-${safe_spec}.json"
task_name="${gradle_args[0]}"
extra_args=("${gradle_args[@]:1}")

set +e
"$runner" --repo "$repo_root" --task "$task_name" --log-dir "$log_dir" -- "${extra_args[@]}" >"$evidence_file"
status=$?
set -e

if [[ "$status" -ne 0 ]]; then
  log_file="$(
    python3 - "$evidence_file" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        print(json.load(handle).get("logFile", ""))
except Exception:
    print("")
PY
  )"
  echo "gradle-check-green: ./gradlew --no-daemon $check_spec failed; evidence: $evidence_file; log: $log_file" >&2
  if [[ -n "$log_file" && -f "$log_file" ]]; then
    tail -n 80 "$log_file" >&2 || true
  fi
  exit "$status"
fi

echo "gradle-check-green: ./gradlew --no-daemon $check_spec passed; evidence: $evidence_file"
