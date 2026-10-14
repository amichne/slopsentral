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
"""Explicit checkout setup. uv is a prerequisite, never downloaded implicitly."""

from pathlib import Path

from python_checks.gates import Command, Completed, Stage, run


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    commands = (
        Command(Stage.SETUP, "uv", ("sync", "--locked", "--group", "refactor")),
        Command(Stage.SETUP, "npm", ("ci", "--ignore-scripts")),
    )
    for command in commands:
        if not isinstance(run(command, root), Completed):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
