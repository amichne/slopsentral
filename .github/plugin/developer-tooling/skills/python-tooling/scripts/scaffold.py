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
"""Create a local automation project without overwriting an existing path."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


def scaffold(destination: Path) -> None:
    assets = Path(__file__).resolve().parents[1] / "assets"
    destination.mkdir(parents=True, exist_ok=False)
    for name in ("standalone.py", "pyproject.toml", "setup.py", "setup.py.lock"):
        _ = shutil.copy2(assets / name, destination / name)
    _ = (destination / ".python-version").write_text("3.12\n", encoding="utf-8")
    _ = (destination / ".gitignore").write_text(
        ".venv/\n__pycache__/\n.pytest_cache/\n.ruff_cache/\n", encoding="utf-8"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("--out", required=True, type=Path)
    destination: Path = parser.parse_args().out
    try:
        scaffold(destination)
    except FileExistsError:
        print("scaffold: destination already exists")
        return 2
    except OSError:
        print("scaffold: filesystem setup failed; inspect the destination before retrying")
        return 2
    print(
        f"Created {destination}. Review source, then run uv run --locked --script setup.py there."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
