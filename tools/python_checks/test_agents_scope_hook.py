from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "source/hooks/agents-md-scope.py"


def test_explicit_assessment_needs_no_git_or_baseline(tmp_path: Path) -> None:
    repo = tmp_path / "workspace"
    (repo / "module").mkdir(parents=True)
    _ = (repo / "AGENTS.md").write_text("Use the new root command.\n")
    _ = (repo / "module/AGENTS.md").write_text("Use the module command.\n")
    denied = tmp_path / "bin"
    denied.mkdir()
    ledger = tmp_path / "git-called"
    git_command = denied / "git"
    _ = git_command.write_text(f"#!/bin/sh\necho called >> '{ledger}'\nexit 99\n")
    git_command.chmod(0o755)

    def assess(names: list[str]) -> dict[str, object]:
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "assess"],
            input=json.dumps(
                {
                    "hook_event_name": "Stop",
                    "cwd": str(repo),
                    "session_id": "first-run",
                    "changed_paths": names,
                }
            ),
            text=True,
            capture_output=True,
            check=False,
            env={**os.environ, "PATH": str(denied)},
        )
        assert result.returncode == 0, result.stderr
        return json.loads(result.stdout)

    assert assess([]) == {}
    result = assess(["module/main.py", "AGENTS.md", "deleted/AGENTS.md"])
    assert result["decision"] == "block"
    reason = str(result["reason"])
    assert '"module/main.py" -> review "module/AGENTS.md"' in reason
    assert "Use the new root command." in reason
    assert "module/AGENTS.md" in reason
    assert "The instruction file was deleted" in reason
    assert assess(["../outside"])["decision"] == "block"
    assert "INVALID_EVENT" in str(assess(["../outside"]))
    assert not ledger.exists()
    assert not (tmp_path / "codex").exists()


def test_hook_is_composed_and_local_commands_exist() -> None:
    plugin = json.loads((ROOT / "source/plugins/software-engineering/plugin.json").read_text())
    assert "agents-md-scope" in {hook["name"] for hook in plugin["hooks"]}
    local = json.loads((ROOT / ".codex/hooks.json").read_text())
    commands = [
        item["command"]
        for groups in local["hooks"].values()
        for group in groups
        for item in group["hooks"]
    ]
    assert all("agents-md-turn-refresh.sh" not in command for command in commands)


def git(root: Path, *args: str) -> None:
    result = subprocess.run(["git", "-C", str(root), *args], capture_output=True, check=False)
    assert result.returncode == 0, result.stderr


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    repo = tmp_path / "repo with spaces;literal"
    repo.mkdir()
    git(repo, "init", "-q")
    git(repo, "config", "user.email", "fixture@example.com")
    git(repo, "config", "user.name", "Fixture")
    _ = (repo / "AGENTS.md").write_text("# Repository\nUse the root command.\n")
    (repo / "module").mkdir()
    _ = (repo / "module/main.py").write_text("original\n")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "fixture")
    return repo


def invoke(
    repo: Path,
    event: str = "PostToolUse",
    *,
    session: str = "session-a",
    arguments: tuple[str, ...] = (),
    raw: str | None = None,
) -> dict[str, object]:
    payload = {
        "hook_event_name": event,
        "session_id": session,
        "cwd": str(repo),
        "turn_id": "turn-a",
        "tool_name": "Bash",
        "tool_input": {},
        "tool_response": {"exit_code": 1},
        "stop_hook_active": False,
    }
    environment = {
        **os.environ,
        "CODEX_HOME": str(repo.parent / "codex"),
        "PLUGIN_DATA": str(repo.parent / "data"),
    }
    result = subprocess.run(
        [sys.executable, str(SCRIPT), *arguments],
        input=json.dumps(payload) if raw is None else raw,
        text=True,
        cwd=repo.parent,
        env=environment,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def review(repo: Path, session: str = "session-a") -> dict[str, object]:
    return invoke(
        repo,
        arguments=(
            "review",
            "--cwd",
            str(repo),
            "--session-id",
            session,
            "--note",
            "The root instructions still describe this source.",
        ),
    )


def test_preexisting_dirt_and_read_only_tools_do_not_need_edits(workspace: Path) -> None:
    _ = (workspace / "module/main.py").write_text("preexisting\n")
    assert invoke(workspace, "UserPromptSubmit") == {}
    assert invoke(workspace) == {}
    assert invoke(workspace, "Stop") == {}


def test_source_changes_gate_completion_and_no_change_review_is_valid(workspace: Path) -> None:
    assert invoke(workspace, "UserPromptSubmit") == {}
    _ = (workspace / "module/main.py").write_text("new source\n")
    output = invoke(workspace)
    assert "module/main.py" in json.dumps(output)
    stopped = invoke(workspace, "Stop")
    assert stopped["decision"] == "block"
    assert "AGENTS.md" in str(stopped["reason"])
    assert not (workspace / "module/AGENTS.md").exists()
    assert review(workspace)["type"] == "REVIEW_RECORDED"
    assert invoke(workspace, "Stop") == {}
    _ = (workspace / "module/main.py").write_text("later source\n")
    assert invoke(workspace, "Stop")["decision"] == "block"


def test_instruction_changes_refresh_context_and_name_descendants(workspace: Path) -> None:
    _ = (workspace / "module/AGENTS.md").write_text("# Local\nUse the module command.\n")
    git(workspace, "add", ".")
    git(workspace, "commit", "-qm", "child guidance")
    assert invoke(workspace, "UserPromptSubmit") == {}
    _ = (workspace / "AGENTS.md").write_text("# Repository\nUse the new root command.\n")
    output = json.dumps(invoke(workspace))
    assert "Use the new root command." in output
    assert "module/AGENTS.md" in output
    assert "propagation" in output
    assert invoke(workspace) == {}


def test_new_scope_and_deleted_instruction_need_review(workspace: Path) -> None:
    assert invoke(workspace, "UserPromptSubmit") == {}
    _ = (workspace / "module/pyproject.toml").write_text('[project]\nname = "module"\n')
    output = json.dumps(invoke(workspace))
    assert "module/AGENTS.md" in output
    _ = (workspace / "module/AGENTS.md").write_text("# Module\nUse the module test command.\n")
    assert review(workspace)["type"] == "REVIEW_RECORDED"
    assert invoke(workspace, "Stop") == {}
    (workspace / "module/AGENTS.md").unlink()
    assert "module/AGENTS.md" in json.dumps(invoke(workspace))
    assert invoke(workspace, "Stop")["decision"] == "block"


def test_committed_edits_and_sessions_remain_distinct(workspace: Path) -> None:
    assert invoke(workspace, "UserPromptSubmit") == {}
    _ = (workspace / "module/main.py").write_text("committed source\n")
    git(workspace, "add", ".")
    git(workspace, "commit", "-qm", "source change")
    assert invoke(workspace, "Stop")["decision"] == "block"
    assert invoke(workspace, "UserPromptSubmit", session="session-b") == {}
    assert invoke(workspace, "Stop", session="session-b") == {}
    assert invoke(workspace, "Stop")["decision"] == "block"


def test_generated_files_do_not_request_authored_instruction_edits(workspace: Path) -> None:
    assert invoke(workspace, "UserPromptSubmit") == {}
    generated = workspace / ".agents/plugins/generated"
    generated.mkdir(parents=True)
    _ = (generated / "AGENTS.md").write_text("generated\n")
    assert invoke(workspace) == {}
    assert invoke(workspace, "Stop") == {}


@pytest.mark.parametrize("raw", ["not-json", "[]", "{}"])
def test_malformed_events_reject_without_repository_writes(workspace: Path, raw: str) -> None:
    output = invoke(workspace, raw=raw)
    assert "INVALID_EVENT" in json.dumps(output)
    assert not (workspace / ".agent-turn").exists()


def test_symlinked_instructions_cannot_deliver_outside_content(workspace: Path) -> None:
    assert invoke(workspace, "UserPromptSubmit") == {}
    secret = workspace.parent / "private.md"
    _ = secret.write_text("private-source-payload")
    (workspace / "module/AGENTS.md").symlink_to(secret)
    output = json.dumps(invoke(workspace))
    assert "UNSAFE_INSTRUCTION" in output
    assert "private-source-payload" not in output


def test_absent_start_never_reports_silent_success(workspace: Path) -> None:
    output = invoke(workspace, "Stop")
    assert "BASELINE_CREATED" in json.dumps(output)
    assert "unproved" in json.dumps(output)


def test_rename_tracks_both_owners_and_repeated_stop_keeps_the_gate(workspace: Path) -> None:
    assert invoke(workspace, "UserPromptSubmit") == {}
    (workspace / "other").mkdir()
    git(workspace, "mv", "module/main.py", "other/main.py")
    output = json.dumps(invoke(workspace))
    assert "module/main.py" in output
    assert "other/main.py" in output
    first = invoke(workspace, "Stop")
    assert first["decision"] == "block"
    assert invoke(workspace, "Stop") == first


def test_no_change_receipt_needs_a_real_note(workspace: Path) -> None:
    assert invoke(workspace, "UserPromptSubmit") == {}
    _ = (workspace / "module/main.py").write_text("changed\n")
    result = invoke(
        workspace,
        arguments=("review", "--cwd", str(workspace), "--session-id", "session-a", "--note", " "),
    )
    assert "MISSING_REVIEW" in json.dumps(result)
    assert invoke(workspace, "Stop")["decision"] == "block"


def test_corrupt_state_cannot_silently_release_the_stop_gate(workspace: Path) -> None:
    assert invoke(workspace, "UserPromptSubmit") == {}
    state = next((workspace.parent / "codex/state/agents-md-scope").glob("*.json"))
    _ = state.write_text('{"version":1}')
    output = invoke(workspace, "Stop")
    assert output["decision"] == "block"
    assert "INVALID_STATE" in str(output["reason"])


def test_changes_between_user_prompts_keep_the_review_obligation(workspace: Path) -> None:
    assert invoke(workspace, "UserPromptSubmit") == {}
    _ = (workspace / "module/main.py").write_text("external editor change\n")
    assert "module/main.py" in json.dumps(invoke(workspace, "UserPromptSubmit"))
    assert invoke(workspace, "Stop")["decision"] == "block"


def test_global_install_preserves_other_hooks_and_uses_immutable_code(tmp_path: Path) -> None:
    codex_home = tmp_path / "home with spaces"
    codex_home.mkdir()
    _ = (codex_home / "config.toml").write_text("[features]\nhooks = true\n")
    other = {"matcher": "Bash", "hooks": [{"type": "command", "command": "existing-hook"}]}
    original = json.dumps({"hooks": {"Stop": [other]}})
    _ = (codex_home / "hooks.json").write_text(original)
    command = [
        sys.executable,
        str(ROOT / "tools/install_agents_hook.py"),
        "--codex-home",
        str(codex_home),
    ]
    for expected_change in (True, False):
        result = subprocess.run(command, text=True, capture_output=True, check=False)
        assert result.returncode == 0, result.stderr
        output = json.loads(result.stdout)
        assert output["changed"] is expected_change
        assert Path(output["runtime"]).read_bytes() == SCRIPT.read_bytes()
        assert (
            Path(output["runtime"] + ".lock").read_bytes()
            == Path(str(SCRIPT) + ".lock").read_bytes()
        )
    installed = json.loads((codex_home / "hooks.json").read_text())
    assert installed["hooks"]["Stop"][0] == other
    assert len(installed["hooks"]["Stop"]) == 2
    backup = next(codex_home.glob("hooks.json.before-agents-md-scope-*"))
    assert backup.read_text() == original


def test_disabled_host_install_does_not_change_configuration(tmp_path: Path) -> None:
    _ = (tmp_path / "config.toml").write_text("[features]\nhooks = false\n")
    result = subprocess.run(
        [sys.executable, str(ROOT / "tools/install_agents_hook.py"), "--codex-home", str(tmp_path)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    assert "HOOKS_DISABLED" in result.stdout
    assert not (tmp_path / "hooks.json").exists()


def test_first_commit_in_an_unborn_repository_keeps_source_changes(tmp_path: Path) -> None:
    repo = tmp_path / "unborn"
    repo.mkdir()
    git(repo, "init", "-q")
    git(repo, "config", "user.email", "fixture@example.com")
    git(repo, "config", "user.name", "Fixture")
    _ = (repo / "main.py").write_text("baseline\n")
    assert invoke(repo, "UserPromptSubmit") == {}
    _ = (repo / "main.py").write_text("changed before first commit\n")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "first commit")
    output = invoke(repo, "Stop")
    assert output["decision"] == "block"
    assert "AGENTS.md" in str(output["reason"])
