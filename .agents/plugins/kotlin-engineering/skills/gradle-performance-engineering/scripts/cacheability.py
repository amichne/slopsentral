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
"""Run the cacheability controls with a repository wrapper or a pinned Gradle executable."""

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path


class ExperimentError(ValueError):
    """The task outcome or artifact differed from the independent expectation."""


def run_cases(gradle: Path, root: Path) -> list[str]:
    fixture = Path(__file__).resolve().parents[1] / "assets/cacheability"

    def build(
        name: str, flavor: str, *, cache: bool, hit: bool = False, broken: bool = False
    ) -> bytes:
        checkout = root / name
        _ = shutil.copytree(fixture, checkout)
        _ = (checkout / "flavor.txt").write_text(flavor)
        args = [
            str(gradle),
            "--offline",
            "--no-daemon",
            "--console=plain",
            "--gradle-user-home",
            str(root / ("broken-home" if broken else "normal-home")),
            "--build-cache" if cache else "--no-build-cache",
        ]
        if broken:
            args.append("-PomitInput")
        # Examine false-hit bytes directly. Valid cases also exercise a downstream task.
        args.append("render" if broken else "consume")
        run = subprocess.run(
            args,
            cwd=checkout,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        expected = "> Task :render FROM-CACHE" if hit else "> Task :render"
        if run.returncode or expected not in run.stdout.splitlines():
            detail = f"{name}: expected {expected}\n{run.stdout}"
            raise ExperimentError(detail)
        return (checkout / "build/label.txt").read_bytes()

    def equal(case: str, actual: bytes, expected: bytes) -> None:
        if actual != expected:
            detail = f"{case}: expected {expected!r}, got {actual!r}"
            raise ExperimentError(detail)

    mint = build("cold-a", "mint", cache=False)
    equal("fresh output", mint, b"tea:mint\n")
    equal("repeatability", build("cold-b", "mint", cache=False), mint)
    equal("seed", build("seed", "mint", cache=True), mint)
    equal("relocation", build("relocated", "mint", cache=True, hit=True), mint)
    changed = build("cold-edit", "lemon", cache=False)
    equal("fresh edit", changed, b"tea:lemon\n")
    equal("invalidation", build("edit", "lemon", cache=True), changed)
    equal("control seed", build("bad-seed", "mint", cache=True, broken=True), mint)
    stale = build("bad-edit", "lemon", cache=True, hit=True, broken=True)
    oracle = build("bad-fresh", "lemon", cache=False, broken=True)
    equal("control oracle", oracle, changed)
    equal("wrong restored bytes", stale, mint)
    return ["REPEATABLE", "RELOCATED_HIT", "INPUT_INVALIDATED", "FALSE_HIT_DETECTED"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("gradle", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="gradle-cache-proof-") as temp:
        try:
            cases = run_cases(args.gradle.resolve(), Path(temp))
        except (OSError, ExperimentError) as exc:
            print(json.dumps({"outcome": "FAILED", "detail": str(exc)}))
            return 1
    print(json.dumps({"outcome": "PASSED", "cases": cases}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
