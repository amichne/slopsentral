#!/usr/bin/env -S uv run --script
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
"""Set up and examine the scaffold development environment."""

from __future__ import annotations

import subprocess
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parent
    commands = (
        ("sync", "--group", "refactor"),
        ("run", "--no-sync", "ruff", "format", "--check", "."),
        ("run", "--no-sync", "ruff", "check", "."),
        ("run", "--no-sync", "pyright"),
        ("run", "--no-sync", "pytest"),
    )
    for arguments in commands:
        try:
            result = subprocess.run(["uv", *arguments], cwd=root, check=False)
        except OSError:
            print(f"setup: stage={arguments[0]} outcome=uv-unavailable")
            return 2
        if result.returncode:
            print(f"setup: stage={arguments[0]} outcome=failed exit={result.returncode}")
            return result.returncode
    print("setup: outcome=verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
