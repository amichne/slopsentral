#!/usr/bin/env -S uv run --locked --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = ["uv==0.7.22", "pytest==8.4.2"]
# [tool.uv]
# no-build = true
# required-version = ">=0.12.9"
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""Find the pinned legacy uv executable inside this isolated test environment."""

import subprocess
import sys
from importlib.metadata import PackageNotFoundError, distribution
from pathlib import Path


def main() -> int:
    try:
        package = distribution("uv")
    except PackageNotFoundError:
        print("legacy-uv-probe: distribution missing", file=sys.stderr)
        return 2
    files = package.files
    if package.version != "0.7.22" or files is None:
        print("legacy-uv-probe: distribution identity mismatch", file=sys.stderr)
        return 2
    executables = [
        Path(package.locate_file(file)).resolve() for file in files if file.name in {"uv", "uv.exe"}
    ]
    if len(executables) != 1:
        print("legacy-uv-probe: executable identity is ambiguous", file=sys.stderr)
        return 2
    executable = executables[0]
    version = subprocess.run([executable, "--version"], capture_output=True, text=True, check=False)
    if version.returncode != 0 or version.stdout.split()[:2] != ["uv", "0.7.22"]:
        print("legacy-uv-probe: executable version mismatch", file=sys.stderr)
        return 2
    print(executable)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
