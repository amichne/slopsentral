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
"""Install a standalone authored skill with staged replacement and rollback."""

from __future__ import annotations

import argparse
import filecmp
import json
import os
import re
import shutil
import tempfile
from pathlib import Path


def same(left: Path, right: Path) -> bool:
    if right.is_symlink() or not right.is_dir():
        return False
    comparison = filecmp.dircmp(left, right)
    if comparison.left_only or comparison.right_only or comparison.funny_files:
        return False
    for name in comparison.common_files:
        if not filecmp.cmp(left / name, right / name, shallow=False):
            return False
    return all(same(left / name, right / name) for name in comparison.common_dirs)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("skill")
    _ = parser.add_argument(
        "--codex-home",
        type=Path,
        default=Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex"))),
    )
    _ = parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9-]+", args.skill):
        print("error: invalid skill name")
        return 2
    root = Path(__file__).resolve().parents[1]
    marketplace = json.loads((root / "source/adaptable.marketplace.json").read_text())
    entry = next((item for item in marketplace["skills"] if item["name"] == args.skill), None)
    if entry is None:
        print(f"error: skill is not listed in the marketplace: {args.skill}")
        return 2
    source = (root / "source" / entry["path"]).resolve()
    if not source.is_relative_to(root / "source/skills") or not (source / "SKILL.md").is_file():
        print("error: marketplace skill source is incomplete")
        return 1
    skills = args.codex_home / "skills"
    skills.mkdir(parents=True, exist_ok=True)
    destination = skills / args.skill
    status = "installed"
    with tempfile.TemporaryDirectory(prefix=".install-skill.", dir=skills) as temporary:
        staging = Path(temporary)
        staged = staging / args.skill
        shutil.copytree(source, staged, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        if destination.exists() or destination.is_symlink():
            if same(staged, destination):
                status = "unchanged"
            elif not args.force:
                print(f"error: destination already contains a different skill: {destination}")
                print("help: tools/install_skill.py --force")
                return 1
            else:
                backup = (
                    Path(tempfile.mkdtemp(prefix=f".{args.skill}.recovery-", dir=skills))
                    / "previous"
                )
                destination.rename(backup)
                try:
                    staged.rename(destination)
                except OSError:
                    _ = backup.rename(destination)
                    backup.parent.rmdir()
                    raise
                if backup.is_symlink():
                    backup.unlink()
                else:
                    shutil.rmtree(backup)
                backup.parent.rmdir()
                status = "replaced"
        else:
            staged.rename(destination)
    print(
        f"skill: {json.dumps(args.skill)}\ndestination: {json.dumps(str(destination))}\nstatus: {status}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
