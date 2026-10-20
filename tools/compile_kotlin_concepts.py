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
"""Compile legal Kotlin concepts and verify the exact forbidden diagnostic."""

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
compiler = shutil.which(sys.argv[1] if len(sys.argv[1:]) == 1 else "kotlinc")
if compiler is None or len(sys.argv[1:]) > 1:
    msg = "compile-kotlin-concepts: compiler unavailable or invalid arguments"
    raise SystemExit(msg)
sources = sorted((root / "source/concepts").rglob("*.kt"))
if not sources:
    msg = "compile-kotlin-concepts: no Kotlin concepts found"
    raise SystemExit(msg)
with tempfile.TemporaryDirectory() as temporary:
    for index, source in enumerate(sources):
        result = subprocess.run(
            [compiler, str(source), "-d", f"{temporary}/concept-{index}.jar"], check=False
        )
        if result.returncode:
            raise SystemExit(result.returncode)
    rejected = subprocess.run(
        [
            compiler,
            str(root / "tools/fixtures/kotlin-concepts/non-exhaustive-sealed-when.fail.kt"),
            "-d",
            f"{temporary}/unexpected.jar",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if rejected.returncode != 1 or "must be exhaustive" not in rejected.stderr:
        msg = "compile-kotlin-concepts: expected exhaustive-when diagnostic missing"
        raise SystemExit(msg)
    environment = dict(
        os.environ, PATH=str(Path(compiler).parent) + os.pathsep + os.environ.get("PATH", "")
    )
    result = subprocess.run(
        ["node", str(root / "source/skills/semantic-ratchet/scripts/check-proof-examples.mjs")],
        env=environment,
        check=False,
    )
    if result.returncode:
        raise SystemExit(result.returncode)
print(f"OK Kotlin concepts: {len(sources)} compiled; sealed-when misuse rejected")
