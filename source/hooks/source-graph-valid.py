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
"""Check the selected repository without a shell or implicit cwd."""

import argparse
import subprocess
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("--repo", type=Path, default=Path.cwd())
    repo = parser.parse_args().repo.resolve()
    if not repo.is_dir():
        return 2
    if not (repo / "source/adaptable.marketplace.json").is_file():
        return 0
    validator = repo / "tools/validate-source-graph.mjs"
    if not validator.is_file():
        return 1
    try:
        return subprocess.run(
            ["node", str(validator), "--repo", str(repo)], cwd=repo, check=False
        ).returncode
    except OSError:
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
