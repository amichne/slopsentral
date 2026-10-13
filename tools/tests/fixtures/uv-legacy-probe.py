#!/usr/bin/env -S uv run --locked --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = ["uv==0.7.22"]
# [tool.uv]
# no-build = true
# required-version = ">=0.12.9"
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""Find the pinned legacy uv executable inside this isolated test environment."""

import shutil
import subprocess


def main() -> int:
    executable = shutil.which("uv")
    if executable is None:
        return 2
    version = subprocess.run([executable, "--version"], capture_output=True, text=True, check=False)
    if version.returncode != 0 or not version.stdout.startswith("uv 0.7.22 "):
        return 2
    print(executable)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
