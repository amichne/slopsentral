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
"""Project all three harnesses in a managed temporary directory."""

import argparse
import os
import subprocess
import sys
import tempfile
from contextlib import nullcontext
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
_ = parser.add_argument("--with-host-tools", action="store_true")
_ = parser.add_argument("--out", type=Path, help="Keep tested projections in a new directory")
arguments = parser.parse_args()
root = Path(__file__).resolve().parents[1]
if arguments.out is not None:
    arguments.out.mkdir(parents=True, exist_ok=False)
with (
    nullcontext(str(arguments.out))
    if arguments.out is not None
    else tempfile.TemporaryDirectory(prefix="slopsentral-projections-")
) as temporary:
    base = Path(temporary)
    for harness in ("codex", "github-copilot", "pi"):
        result = subprocess.run(
            [
                sys.executable,
                "tools/marketplace.py",
                "project",
                "--source",
                ".",
                "--harness",
                harness,
                "--out",
                str(base / harness),
            ],
            cwd=root,
            check=False,
        )
        if result.returncode:
            raise SystemExit(result.returncode)
    if not arguments.with_host_tools:
        raise SystemExit(0)
    for command in (
        ["npm", "run", "check:pi"],
        ["node", "--test", "tools/tests/pi-host.test.mjs"],
    ):
        result = subprocess.run(
            command,
            cwd=root,
            env=dict(os.environ, SLOPSENTRAL_PI_PACKAGE=str(base / "pi/.pi/slopsentral")),
            check=False,
        )
        if result.returncode:
            raise SystemExit(result.returncode)
    environment = dict(
        os.environ,
        REUSE_CODEX_PROJECTION=str(base / "codex"),
        REUSE_COPILOT_PROJECTION=str(base / "github-copilot"),
        INSTRUCTION_MARKETPLACE_ROOT=str(base / "codex"),
        STOP_MARKETPLACE_ROOT=str(base / "codex"),
        KNOWLEDGE_MARKETPLACE_ROOT=str(base / "codex"),
    )
    for name in (
        "asset-reuse-projection",
        "instruction-delivery",
        "stop-output-contract",
        "knowledge-overlay-contract",
    ):
        result = subprocess.run(
            ["node", "--test", f"tools/tests/{name}.test.mjs"],
            cwd=root,
            env=environment,
            check=False,
        )

        if result.returncode:
            raise SystemExit(result.returncode)
    for harness in ("codex", "github-copilot"):
        plugin_tree = ".agents/plugins" if harness == "codex" else ".github/plugin"
        result = subprocess.run(
            [
                "node",
                "--test",
                "tools/tests/gradle-check-green.test.mjs",
                "tools/tests/gradle-wrapper-integrity.test.mjs",
                "tools/tests/openapi-installed-commands.test.mjs",
                "tools/tests/okf-validator-isolation.test.mjs",
                "tools/tests/okf-visualizer-isolation.test.mjs",
                "tools/tests/pkl-installed-entrypoints.test.mjs",
            ],
            cwd=root,
            env=dict(
                os.environ,
                SLOPSENTRAL_GRADLE_HOOK_ROOT=str(
                    base / harness / plugin_tree / "kotlin-engineering"
                ),
                SLOPSENTRAL_OPENAPI_SKILL_ROOT=str(
                    base
                    / harness
                    / plugin_tree
                    / "developer-tooling/skills/openapi-contract-authoring"
                ),
                SLOPSENTRAL_OKF_SKILL_ROOT=str(
                    base / harness / plugin_tree / "repository-knowledge/skills/code-knowledge-base"
                ),
                SLOPSENTRAL_PKL_SKILL_ROOT=str(
                    base / harness / plugin_tree / "developer-tooling/skills/pkl-engineering"
                ),
            ),
            check=False,
        )
        if result.returncode:
            raise SystemExit(result.returncode)
