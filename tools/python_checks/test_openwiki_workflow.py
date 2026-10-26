from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

import pytest
import yaml

from tools.pi_candidate import mapping, sequence

ROOT = Path(__file__).resolve().parents[2]


def git(root: Path, *arguments: str) -> str:
    return subprocess.run(
        ["git", *arguments], cwd=root, check=True, capture_output=True, text=True
    ).stdout


@pytest.mark.parametrize(
    ("changed_path", "operation", "expected"),
    [
        ("openwiki/.last-update.json", "write", False),
        ("openwiki/.page-manifest.json", "write", False),
        ("openwiki/INSTRUCTIONS.md", "write", False),
        ("README.md", "write", False),
        ("openwiki/quickstart.md", "write", True),
        ("openwiki/quickstart.md", "stage", True),
        ("openwiki/quickstart.md", "delete", True),
        ("openwiki/new page;literal.md", "write", True),
        ("openwiki/.claims/quickstart.json", "write", True),
        ("openwiki/.claims/new-page.json", "write", True),
    ],
)
def test_only_substantive_generated_changes_select_a_pr(
    tmp_path: Path, changed_path: str, operation: str, *, expected: bool
) -> None:
    _ = git(tmp_path, "init", "--quiet")
    for name in [
        "README.md",
        "openwiki/quickstart.md",
        "openwiki/INSTRUCTIONS.md",
        "openwiki/.last-update.json",
        "openwiki/.page-manifest.json",
        "openwiki/.claims/quickstart.json",
    ]:
        target = tmp_path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        _ = target.write_text("baseline\n")
    _ = git(tmp_path, "add", ".")
    _ = git(
        tmp_path,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "baseline",
    )
    # Native no-ops refresh the checkpoint and can advance page coverage.
    for name in [".last-update.json", ".page-manifest.json"]:
        _ = (tmp_path / "openwiki" / name).write_text("native checkpoint refresh\n")
    changed = tmp_path / changed_path
    if operation == "delete":
        changed.unlink()
    else:
        _ = changed.write_text("updated\n")
        if operation == "stage":
            _ = git(tmp_path, "add", "--", changed_path)

    loaded: object = yaml.safe_load((ROOT / ".github/workflows/openwiki-update.yml").read_text())
    assert mapping(loaded)
    jobs = loaded["jobs"]
    assert mapping(jobs)
    update = jobs["update"]
    assert mapping(update)
    steps = update["steps"]
    assert sequence(steps)
    proposal = next(
        step
        for step in steps
        if mapping(step)
        and str(step.get("uses", "")).startswith("peter-evans/create-pull-request@")
    )
    condition = proposal.get("if")
    selected = True
    if condition is not None:
        assert isinstance(condition, str)
        match = re.fullmatch(r"steps\.([a-z_]+)\.outputs\.([a-z_]+) == 'true'", condition)
        assert match is not None, condition
        gate = next(step for step in steps if mapping(step) and step.get("id") == match[1])
        assert steps.index(gate) < steps.index(proposal)
        script = gate["run"]
        assert isinstance(script, str)
        output = tmp_path / "action-output"
        before = git(tmp_path, "status", "--porcelain")
        _ = subprocess.run(
            ["bash", "-e", "-o", "pipefail", "-c", script],
            cwd=tmp_path,
            env={**os.environ, "GITHUB_OUTPUT": str(output)},
            check=True,
        )
        # The decision must not discard metadata or stage source changes.
        values = dict(line.split("=", 1) for line in output.read_text().splitlines())
        output.unlink()
        assert git(tmp_path, "status", "--porcelain") == before
        selected = values[match[2]] == "true"
    assert selected is expected
    if selected:
        options = proposal["with"]
        assert mapping(options)
        paths = options["add-paths"]
        assert isinstance(paths, str)
        _ = git(tmp_path, "add", "--all", "--", *paths.splitlines())
        staged = git(tmp_path, "diff", "--cached", "--name-only").splitlines()
        assert "openwiki/.last-update.json" in staged
        assert "openwiki/.page-manifest.json" in staged
