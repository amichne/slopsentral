#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = []
# [tool.uv]
# no-build = true
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""Capture explicit Gradle verification evidence without shell transport."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import tempfile
import time
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("--repo", type=Path, default=Path.cwd())
    _ = parser.add_argument("--task", required=True)
    _ = parser.add_argument("--log-dir", type=Path)
    args, extra = parser.parse_known_args()
    if extra[:1] == ["--"]:
        extra = extra[1:]
    repo = args.repo.resolve()
    wrapper = repo / "gradlew"
    if not wrapper.is_file() or not os.access(wrapper, os.X_OK):
        print(json.dumps({"type": "WRAPPER_UNAVAILABLE"}))
        return 2
    log_dir = args.log_dir or repo / ".agent-turn/kotlin-gradle-validation/logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    started = time.monotonic_ns()
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".log", prefix="gradle-", dir=log_dir, delete=False
    ) as log:
        result = subprocess.run(
            [str(wrapper), "--no-daemon", "--console=plain", args.task, *extra],
            cwd=repo,
            stdout=log,
            stderr=subprocess.STDOUT,
            check=False,
        )
    duration = (time.monotonic_ns() - started) // 1_000_000
    text = Path(log.name).read_text(errors="replace")
    diagnostics = re.findall(r"(?m)^e: .+$", text)[:3]
    failure_summary = (
        " ".join(diagnostics + text.splitlines()[-12:])[:800] if result.returncode else None
    )
    payload = {
        "ok": result.returncode == 0,
        "repoRoot": str(repo),
        "task": args.task,
        "extraArgs": extra,
        "exitCode": result.returncode,
        "durationMs": duration,
        "gradleExecutable": str(wrapper),
        "logFile": log.name,
        "tasksExecuted": len(re.findall(r"(?m)^> Task ", text)),
        "tasksUpToDate": len(re.findall(r"(?m)UP-TO-DATE$", text)),
        "tasksFromCache": len(re.findall(r"(?m)FROM-CACHE$", text)),
        "buildSuccessful": result.returncode == 0 and "BUILD SUCCESSFUL" in text,
        "testTaskDetected": bool(re.search(r"(?:^|:)(test|check)\b", args.task, re.IGNORECASE)),
        "failureSummary": failure_summary,
    }
    print(json.dumps(payload))
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
