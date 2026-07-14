#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: gradle-check-green.sh [--repo PATH]

Runs a Gradle green check when Kotlin, Java, Gradle, or build-logic files changed.

Environment:
  INTELLIGENCE_CHANGED_FILES     Optional changed-file list, separated by newlines or commas.
  INTELLIGENCE_GRADLE_CHECK      Gradle args to run. Overrides repo config. Set to "off" to skip.
  INTELLIGENCE_GRADLE_CHECK_COMMAND_FILE
                                  Repo config file. Defaults to .intelligence/gradle-check-command.
  INTELLIGENCE_GRADLE_LOG_DIR    Log directory. Defaults to .agent-turn/gradle-check-green.

Default command:
  Runs build and test for each changed Gradle module, or root build test when
  root build logic changed.

Repo command file:
  Put one shell-style command line in .intelligence/gradle-check-command.
  Use {changedTasks} to expand the default changed-module task list.
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

tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT

changed_files_file="$tmp_dir/changed-files.txt"
changed_files >"$changed_files_file"
message_file="$tmp_dir/message.txt"
args_file="$tmp_dir/gradle-args.txt"
command_file="${INTELLIGENCE_GRADLE_CHECK_COMMAND_FILE:-$repo_root/.intelligence/gradle-check-command}"

python3 - "$repo_root" "$changed_files_file" "$command_file" "$message_file" "${INTELLIGENCE_GRADLE_CHECK-}" >"$args_file" <<'PY'
from __future__ import annotations

import shlex
import sys
from pathlib import Path

repo = Path(sys.argv[1]).resolve()
changed_files_path = Path(sys.argv[2])
command_file = Path(sys.argv[3])
message_file = Path(sys.argv[4])
env_spec = sys.argv[5]

ROOT_GRADLE_FILES = {
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
    "gradle.properties",
    "gradlew",
    "gradlew.bat",
}


def write_message(value: str) -> None:
    message_file.write_text(value + "\n", encoding="utf-8")


def fail(value: str) -> None:
    print(f"gradle-check-green: error: {value}", file=sys.stderr)
    raise SystemExit(2)


def changed_files() -> list[str]:
    if not changed_files_path.exists():
        return []
    return [
        line.strip()
        for line in changed_files_path.read_text(encoding="utf-8", errors="replace").splitlines()
        if line.strip()
    ]


def is_gradle_owned(relative: str) -> bool:
    path = relative.replace("\\", "/")
    basename = path.rsplit("/", 1)[-1]
    return (
        basename.endswith((".kt", ".kts", ".java"))
        or basename in ROOT_GRADLE_FILES
        or path.startswith("gradle/")
        or path.startswith("build-logic/")
        or path.startswith("buildSrc/")
    )


def root_affecting(relative: str) -> bool:
    path = relative.replace("\\", "/")
    return (
        "/" not in path
        and path in ROOT_GRADLE_FILES
    ) or path.startswith(("gradle/", "build-logic/", "buildSrc/"))


def module_for(relative: str) -> str | None:
    if root_affecting(relative):
        return ""
    candidate = (repo / relative).resolve()
    directory = candidate if candidate.is_dir() else candidate.parent
    while True:
        if (directory / "build.gradle.kts").exists() or (directory / "build.gradle").exists():
            if directory == repo:
                return ""
            try:
                module_parts = directory.relative_to(repo).parts
            except ValueError:
                return ""
            return ":" + ":".join(module_parts)
        if directory == repo or repo not in directory.parents:
            return ""
        directory = directory.parent


def default_changed_tasks(files: list[str]) -> list[str]:
    modules: set[str] = set()
    root_changed = False
    for relative in files:
        if not is_gradle_owned(relative):
            continue
        module = module_for(relative)
        if module == "":
            root_changed = True
        elif module is not None:
            modules.add(module)

    if root_changed:
        return ["build", "test"]
    tasks: list[str] = []
    for module in sorted(modules):
        tasks.extend([f"{module}:build", f"{module}:test"])
    return tasks


def repo_command_spec() -> str:
    if env_spec:
        return env_spec.strip()
    if command_file.exists():
        for raw_line in command_file.read_text(encoding="utf-8", errors="replace").splitlines():
            line = raw_line.strip()
            if line and not line.startswith("#"):
                return line
    return "{changedTasks}"


files = changed_files()
owned_files = [relative for relative in files if is_gradle_owned(relative)]
tasks = default_changed_tasks(owned_files)
spec = repo_command_spec()

if spec in {"off", "skip"}:
    write_message(f"gradle-check-green: skipped by configured command {spec}")
    raise SystemExit(0)

if not owned_files:
    write_message("gradle-check-green: no Kotlin or Gradle-owned changes detected")
    raise SystemExit(0)

try:
    tokens = shlex.split(spec)
except ValueError as error:
    fail(f"invalid Gradle command configuration: {error}")

if not tokens:
    fail("Gradle command configuration produced no Gradle task")

args: list[str] = []
for token in tokens:
    if token == "{changedTasks}":
        args.extend(tasks)
    else:
        args.append(token)

if not args:
    write_message("gradle-check-green: no changed-module Gradle tasks to run")
    raise SystemExit(0)

print("\n".join(args))
PY

if [[ ! -s "$args_file" ]]; then
  if [[ -s "$message_file" ]]; then
    cat "$message_file"
  else
    echo "gradle-check-green: no Gradle command produced"
  fi
  exit 0
fi

gradle_args=()
while IFS= read -r gradle_arg || [[ -n "$gradle_arg" ]]; do
  gradle_args+=("$gradle_arg")
done <"$args_file"

if [[ "${#gradle_args[@]}" -eq 0 ]]; then
  echo "gradle-check-green: Gradle command configuration produced no Gradle task" >&2
  exit 2
fi

log_dir="${INTELLIGENCE_GRADLE_LOG_DIR:-$repo_root/.agent-turn/gradle-check-green}"
mkdir -p "$log_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
safe_spec="$(printf '%s_' "${gradle_args[@]}" | tr -c 'A-Za-z0-9_.-' '_')"
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
  echo "gradle-check-green: ./gradlew --no-daemon ${gradle_args[*]} failed; evidence: $evidence_file; log: $log_file" >&2
  if [[ -n "$log_file" && -f "$log_file" ]]; then
    tail -n 80 "$log_file" >&2 || true
  fi
  exit "$status"
fi

echo "gradle-check-green: ./gradlew --no-daemon ${gradle_args[*]} passed; evidence: $evidence_file"
