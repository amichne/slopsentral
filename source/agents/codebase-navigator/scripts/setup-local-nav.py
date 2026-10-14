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
"""Set up navigation with explicit Git paths and argument-array subprocesses."""

import argparse
import shutil
import subprocess
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("--repo-root", default=".")
    _ = parser.add_argument("--hook-mode", choices=("auto", "collect"), default="collect")
    _ = parser.add_argument("--copilot", action="store_true")
    _ = parser.add_argument("--copilot-only", action="store_true")
    args = parser.parse_args()

    def git(*arguments: str) -> str:
        return subprocess.check_output(["git", "-C", args.repo_root, *arguments], text=True).strip()

    repo = Path(git("rev-parse", "--show-toplevel"))
    scripts = Path(__file__).resolve().parent
    if not args.copilot_only:
        exclude = git("rev-parse", "--path-format=absolute", "--git-path", "info/exclude")
        hooks = Path(git("rev-parse", "--path-format=absolute", "--git-path", "hooks"))
        _ = subprocess.run(
            [
                "uv",
                "run",
                "--locked",
                "--script",
                str(scripts / "navigation-hook.py"),
                "install",
                "--exclude",
                exclude,
                "--hook",
                str(hooks / "post-commit"),
                "--mode",
                args.hook_mode,
            ],
            check=True,
        )
    if args.copilot or args.copilot_only:
        source = scripts.parent / "copilot"
        target = repo / ".github"
        (target / "chatmodes").mkdir(parents=True, exist_ok=True)
        (target / "prompts").mkdir(parents=True, exist_ok=True)
        _ = shutil.copyfile(
            source / "chatmode.md", target / "chatmodes/codebase-navigator.chatmode.md"
        )
        for prompt in (source / "prompts").glob("*.prompt.md"):
            _ = shutil.copyfile(prompt, target / "prompts" / prompt.name)
        instructions = target / "copilot-instructions.md"
        existing = instructions.read_text() if instructions.exists() else ""
        if "<!-- codebase-navigator snippet" not in existing:
            _ = instructions.write_text(
                existing + "\n" + (source / "instructions-snippet.md").read_text()
            )
    print(f"navigation: setup complete: {repo}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
