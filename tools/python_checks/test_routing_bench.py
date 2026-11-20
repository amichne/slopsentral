from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools.routing_bench import (
    Rejected,
    Task,
    Trial,
    files_read,
    parse_answer,
    parse_tasks,
    score,
    summarize,
)

ROOT = Path(__file__).resolve().parents[2]
TASK = Task("hook", "Add a hook.", ("guidance/source-graph\\.md",), ("validate-source-graph",))


def test_committed_task_sets_parse() -> None:
    for name in ("slopsentral.json", "dotfiles.json"):
        document = json.loads((ROOT / "source/evals/routing-bench" / name).read_text())
        assert not isinstance(parse_tasks(document), Rejected)


@pytest.mark.parametrize(
    "document",
    [
        [],
        [{"id": "a", "task": "t", "governing_any": [], "checks_all": ["x"]}],
        [{"id": "a", "task": "t", "governing_any": ["("], "checks_all": ["x"]}],
        [{"id": "a", "task": "t", "governing_any": ["x"], "checks_all": ["x"]}] * 2,
    ],
)
def test_invalid_task_sets_are_rejected(document: object) -> None:
    assert isinstance(parse_tasks(document), Rejected)


def test_read_detection_needs_a_path_token() -> None:
    tracked = ("AGENTS.md", "guidance/source-graph.md", "docs/AGENTS.md")
    read = files_read(
        ("/bin/zsh -lc 'cat guidance/source-graph.md'", "sed -n 1,9p AGENTS.md"), tracked
    )
    assert read == ("AGENTS.md", "guidance/source-graph.md")


def test_reaching_the_owner_and_naming_every_check_passes() -> None:
    answer = (
        '{"governing_files": ["AGENTS.md"], "checks": ["node tools/validate-source-graph.mjs"]}'
    )
    assert score(TASK, ("guidance/source-graph.md",), answer) == (True, True)


def test_missing_check_or_owner_fails_its_dimension() -> None:
    answer = '{"governing_files": ["AGENTS.md"], "checks": ["npm test"]}'
    assert score(TASK, ("AGENTS.md",), answer) == (False, False)
    assert score(TASK, (), "not json") == (False, False)


def test_named_owner_counts_without_a_recorded_read() -> None:
    answer = (
        '{"governing_files": ["guidance/source-graph.md"], "checks": ["validate-source-graph"]}'
    )
    assert score(TASK, (), answer) == (True, True)
    assert parse_answer("prefix " + answer) == ("guidance/source-graph.md", "validate-source-graph")


def test_summary_reports_pass_counts_and_medians() -> None:
    trials = [
        Trial(
            variant="a",
            task="t",
            rep=rep,
            passed=rep == 0,
            reached_governing=True,
            checks_ok=rep == 0,
            input_tokens=100 * (rep + 1),
            cached_input_tokens=0,
            commands=3,
            files_read=("AGENTS.md",),
        )
        for rep in range(3)
    ]
    summary = summarize(trials)
    assert summary["variants"] == {
        "a": {
            "trials": 3,
            "passed": 1,
            "medianInputTokens": 200,
            "meanInputTokens": 200,
            "medianFilesRead": 1,
        }
    }
