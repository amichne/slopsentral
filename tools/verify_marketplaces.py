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
"""Project and check both providers in a managed temporary directory."""

import os
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="slopsentral-projections-") as temporary:
    base = Path(temporary)
    for harness in ("codex", "github-copilot"):
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
            ),
            check=False,
        )
        if result.returncode:
            raise SystemExit(result.returncode)
