#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: gradle-wrapper-integrity.sh [--repo PATH]

Checks Gradle wrapper metadata when wrapper files changed.

Environment:
  INTELLIGENCE_CHANGED_FILES                 Optional changed-file list, separated by newlines or commas.
  INTELLIGENCE_GRADLE_WRAPPER_INTEGRITY      Set to off/skip to disable, or strict to require distributionSha256Sum.
USAGE
}

die() {
  printf 'gradle-wrapper-integrity: error: %s\n' "$*" >&2
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
  [[ -d "$repo_arg" ]] || die "repository path is not a directory: $repo_arg"
  repo_root="$(cd "$repo_arg" && pwd)"
fi

mode="${INTELLIGENCE_GRADLE_WRAPPER_INTEGRITY:-normal}"
case "$mode" in
  off|skip)
    echo "gradle-wrapper-integrity: skipped by INTELLIGENCE_GRADLE_WRAPPER_INTEGRITY=$mode"
    exit 0
    ;;
  normal|strict)
    ;;
  *)
    die "INTELLIGENCE_GRADLE_WRAPPER_INTEGRITY must be normal, strict, off, or skip"
    ;;
esac

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

wrapper_changed="false"
while IFS= read -r changed_file || [[ -n "$changed_file" ]]; do
  case "$changed_file" in
    gradlew|gradlew.bat|gradle/wrapper/gradle-wrapper.jar|gradle/wrapper/gradle-wrapper.properties)
      wrapper_changed="true"
      break
      ;;
  esac
done < <(changed_files)

if [[ "$wrapper_changed" != "true" ]]; then
  echo "gradle-wrapper-integrity: no Gradle wrapper changes detected"
  exit 0
fi

properties="$repo_root/gradle/wrapper/gradle-wrapper.properties"
jar="$repo_root/gradle/wrapper/gradle-wrapper.jar"
wrapper="$repo_root/gradlew"

[[ -f "$properties" ]] || die "missing gradle/wrapper/gradle-wrapper.properties"
[[ -f "$jar" ]] || die "missing gradle/wrapper/gradle-wrapper.jar"
[[ -f "$wrapper" ]] || die "missing gradlew"
[[ -x "$wrapper" ]] || die "gradlew must be executable"

python3 - "$properties" "$jar" "$mode" <<'PY'
from __future__ import annotations

import re
import sys
import zipfile
from pathlib import Path

properties_path = Path(sys.argv[1])
jar_path = Path(sys.argv[2])
mode = sys.argv[3]


def fail(message: str, code: int = 2) -> None:
    print(f"gradle-wrapper-integrity: error: {message}", file=sys.stderr)
    raise SystemExit(code)


def unescape(value: str) -> str:
    replacements = {
        r"\:": ":",
        r"\=": "=",
        r"\ ": " ",
        r"\\": "\\",
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    return value


def parse_properties(path: Path) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith("!"):
            continue
        separator_index = -1
        escaped = False
        for index, char in enumerate(line):
            if escaped:
                escaped = False
                continue
            if char == "\\":
                escaped = True
                continue
            if char in "=:" or char.isspace():
                separator_index = index
                break
        if separator_index < 0:
            key, value = line, ""
        else:
            key = line[:separator_index]
            value = line[separator_index + 1 :].strip()
            if value[:1] in "=:":
                value = value[1:].strip()
        parsed[unescape(key.strip())] = unescape(value)
    return parsed


properties = parse_properties(properties_path)
distribution_url = properties.get("distributionUrl", "")
if not distribution_url:
    fail("gradle-wrapper.properties must define distributionUrl")

if not distribution_url.startswith("https://services.gradle.org/distributions/"):
    fail("distributionUrl must use https://services.gradle.org/distributions/")

if not re.search(r"/gradle-[A-Za-z0-9_.-]+-(?:bin|all)\.zip$", distribution_url):
    fail("distributionUrl must point at a Gradle bin or all distribution zip")

checksum = properties.get("distributionSha256Sum", "")
if checksum and not re.fullmatch(r"[A-Fa-f0-9]{64}", checksum):
    fail("distributionSha256Sum must be a 64-character hex SHA-256 when present")

if mode == "strict" and not checksum:
    fail("strict mode requires distributionSha256Sum")

if not zipfile.is_zipfile(jar_path):
    fail("gradle-wrapper.jar must be a readable JAR file")

with zipfile.ZipFile(jar_path) as wrapper_jar:
    if "org/gradle/wrapper/GradleWrapperMain.class" not in wrapper_jar.namelist():
        fail("gradle-wrapper.jar must contain GradleWrapperMain")

if checksum:
    print("gradle-wrapper-integrity: wrapper metadata looks valid with distributionSha256Sum")
else:
    print("gradle-wrapper-integrity: wrapper metadata looks valid; add distributionSha256Sum for strict verification")
PY
