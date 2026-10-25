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
"""Create a source-bound release tag without replacing an existing tag."""

from __future__ import annotations

import argparse
import re

from tools.pi_candidate import CandidateError, Failure, require_identity, run_command


def ensure_tag(repository: str, tag: str, revision: str) -> None:
    require_identity(repository, revision)
    if not re.fullmatch(r"slopsentral-v0\.1\.[1-9][0-9]*", tag):
        raise CandidateError(Failure.INVALID_IDENTITY)
    existing = run_command(
        ["git", "ls-remote", f"https://github.com/{repository}.git", f"refs/tags/{tag}"]
    )
    if existing:
        if existing.split() != [revision, f"refs/tags/{tag}"]:
            raise CandidateError(Failure.WRONG_PRODUCER)
        return
    _ = run_command(
        [
            "gh",
            "api",
            "--method",
            "POST",
            f"repos/{repository}/git/refs",
            "-f",
            f"ref=refs/tags/{tag}",
            "-f",
            f"sha={revision}",
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("command", choices=("ensure-tag",))
    _ = parser.add_argument("repository")
    _ = parser.add_argument("tag")
    _ = parser.add_argument("revision")
    args = parser.parse_args()
    try:
        ensure_tag(str(args.repository), str(args.tag), str(args.revision))
    except CandidateError as error:
        parser.exit(1, f"release-assets: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
