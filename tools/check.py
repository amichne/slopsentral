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
"""Run the repository's strict Python checks; stop at the first failed stage."""

from pathlib import Path
from typing import assert_never

from python_checks.gates import Completed, Failed, Unavailable, plan, run


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    for command in plan():
        result = run(command, root)
        match result:
            case Completed():
                continue
            case Failed(stage, status):
                print(f"check: stage={stage.value} outcome=failed exit={status}")
                return 1
            case Unavailable(stage):
                print(f"check: stage={stage.value} outcome=unavailable")
                return 2
        assert_never(result)
    print("check: outcome=completed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
