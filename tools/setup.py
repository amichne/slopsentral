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

import argparse
from pathlib import Path

from python_checks.gates import Command, Completed, Stage, run


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument(
        "--with-host-tools",
        action="store_true",
        help="Install Pi, Mintlify, and JavaScript audit tools",
    )
    arguments = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    commands = (Command(Stage.SETUP, "uv", ("sync", "--locked", "--group", "refactor")),)
    if arguments.with_host_tools:
        commands += (Command(Stage.SETUP, "npm", ("ci", "--ignore-scripts")),)
    for command in commands:
        if not isinstance(run(command, root), Completed):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
