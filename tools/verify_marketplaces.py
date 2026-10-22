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
"""Project and check all three providers in a managed temporary directory."""

import os
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="slopsentral-projections-") as temporary:
    base = Path(temporary)
    for harness in ("codex", "github-copilot", "amp"):
        result = subprocess.run(
            [
                "node",
                "tools/project-marketplaces.mjs",
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
    environment = dict(
        os.environ,
        REUSE_CODEX_PROJECTION=str(base / "codex"),
        REUSE_COPILOT_PROJECTION=str(base / "github-copilot"),
        INSTRUCTION_MARKETPLACE_ROOT=str(base / "codex"),
        STOP_MARKETPLACE_ROOT=str(base / "codex"),
        KNOWLEDGE_MARKETPLACE_ROOT=str(base / "codex"),
        SLOPSENTRAL_AMP_ROOT=str(base / "amp/.amp/plugins"),
    )
    for name in (
        "amp-projection",
        "full-plugin-delivery",
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
    for harness, plugin_tree in (
        ("codex", ".agents/plugins"),
        ("github-copilot", ".github/plugin"),
        ("amp", ".amp/plugins"),
    ):
        result = subprocess.run(
            [
                "node",
                "--test",
                "tools/tests/openapi-installed-commands.test.mjs",
                "tools/tests/okf-validator-isolation.test.mjs",
                "tools/tests/okf-visualizer-isolation.test.mjs",
                "tools/tests/pkl-installed-entrypoints.test.mjs",
                "tools/tests/schema-contracts-runtime.test.mjs",
            ],
            cwd=root,
            env=dict(
                os.environ,
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
                SLOPSENTRAL_SCHEMA_SKILL_ROOT=str(
                    base / harness / plugin_tree / "developer-tooling/skills/manage-json-schemas"
                ),
            ),
            check=False,
        )
        if result.returncode:
            raise SystemExit(result.returncode)
