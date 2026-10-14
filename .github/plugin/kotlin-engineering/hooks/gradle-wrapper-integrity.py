#!/usr/bin/env -S uv run --locked --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = []
# [tool.uv]
# no-build = true
# required-version = ">=0.12.9"
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///

import argparse
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(
    0, str(Path(__file__).resolve().parents[1] / "skills/kotlin-gradle-validation/scripts")
)
from gradle_repository import (  # noqa: E402 - delivered skill owns repository selection
    ResolutionFailure,
    resolve_project_directory,
)

parser = argparse.ArgumentParser(description="Verify changed Gradle wrapper metadata")
_ = parser.add_argument("--repo", type=Path, default=Path.cwd())
requested: Path = parser.parse_args().repo
mode = os.environ.get("INTELLIGENCE_GRADLE_WRAPPER_INTEGRITY", "normal")
if mode in {"off", "skip"}:
    print("gradle-wrapper-integrity: skipped")
    raise SystemExit(0)
if mode not in {"normal", "strict"}:
    print("gradle-wrapper-integrity: invalid mode", file=sys.stderr)
    raise SystemExit(2)
repo = resolve_project_directory(requested)
if isinstance(repo, ResolutionFailure):
    print(f"gradle-wrapper-integrity: {repo.value}", file=sys.stderr)
    raise SystemExit(2)
changed = os.environ.get("INTELLIGENCE_CHANGED_FILES")
if changed is None:
    collected: list[str] = []
    for args in (
        ("diff", "--name-only", "HEAD", "--"),
        ("ls-files", "--others", "--exclude-standard"),
    ):
        result = subprocess.run(
            ["git", "-C", str(repo.path), *args], capture_output=True, text=True, check=False
        )
        if result.returncode:
            print("gradle-wrapper-integrity: change discovery failed", file=sys.stderr)
            raise SystemExit(2)
        collected.append(result.stdout)
    changed = "\n".join(collected)
if not set(changed.replace(",", "\n").splitlines()) & {
    "gradlew",
    "gradlew.bat",
    "gradle/wrapper/gradle-wrapper.jar",
    "gradle/wrapper/gradle-wrapper.properties",
}:
    print("gradle-wrapper-integrity: no Gradle wrapper changes detected")
    raise SystemExit(0)
properties_path = repo.path / "gradle/wrapper/gradle-wrapper.properties"
jar_path = repo.path / "gradle/wrapper/gradle-wrapper.jar"
if (
    not properties_path.is_file()
    or not jar_path.is_file()
    or not os.access(repo.path / "gradlew", os.X_OK)
):
    print(
        "gradle-wrapper-integrity: missing wrapper files or executable permission", file=sys.stderr
    )
    raise SystemExit(2)


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
        if not line or line.startswith(("#", "!")):
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
    print(
        "gradle-wrapper-integrity: wrapper metadata looks valid; add distributionSha256Sum for strict verification"
    )
