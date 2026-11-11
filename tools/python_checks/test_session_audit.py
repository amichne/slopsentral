import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

CLI = Path(__file__).resolve().parents[1] / "session_audit.py"


def invoke(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(CLI), *args], capture_output=True, text=True, check=False
    )


def write_log(path: Path, *entries: dict[str, object]) -> str:
    _ = path.write_text("".join(json.dumps(entry) + "\n" for entry in entries))
    return str(path)


def test_pi_history_uses_selected_branch_and_omits_bodies(tmp_path: Path) -> None:
    def message(identifier: str, parent: str | None, **payload: object) -> dict[str, object]:
        return {"type": "message", "id": identifier, "parentId": parent, "message": payload}

    path = write_log(
        tmp_path / "pi.jsonl",
        {"type": "session", "id": "session-pi", "version": 3},
        message("u", None, role="user", content="private question"),
        message(
            "abandoned",
            "u",
            role="assistant",
            content=[
                {
                    "type": "toolCall",
                    "id": "unused",
                    "name": "bash",
                    "arguments": {"command": "false"},
                },
            ],
        ),
        message(
            "a",
            "u",
            role="assistant",
            content=[
                {"type": "thinking", "thinking": "private reasoning"},
                {"type": "toolCall", "id": "call", "name": "read", "arguments": {"path": "marker"}},
            ],
        ),
        message(
            "r",
            "a",
            role="toolResult",
            toolCallId="call",
            toolName="read",
            isError=False,
            durationMs=7,
            content=[{"type": "text", "text": "independent marker"}],
        ),
    )
    summary = invoke("history", path)
    assert summary.returncode == 0, summary.stderr
    assert json.loads(summary.stdout)["tools"] == {
        "read": {"calls": 1, "ok": 1, "error": 0, "unknown": 0, "missing": 0},
    }
    assert "private" not in summary.stdout
    tools = invoke("history", path, "--view", "tools", "--details", "--after-line", "4")
    assert tools.returncode == 0, tools.stderr
    events = json.loads(tools.stdout)["events"]
    assert [
        (event["line"], event["callId"], event["durationMs"], event["text"]) for event in events
    ] == [(5, "call", 7, "independent marker")]
    assert "private reasoning" not in tools.stdout


def test_codex_history_uses_response_items_once(tmp_path: Path) -> None:
    path = write_log(
        tmp_path / "codex.jsonl",
        {"type": "session_meta", "payload": {"id": "session-codex"}},
        {
            "type": "response_item",
            "payload": {
                "type": "message",
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": "<environment_context>noise</environment_context>",
                    },
                    {"type": "input_text", "text": "actual question"},
                ],
            },
        },
        {"type": "event_msg", "payload": {"type": "user_message", "message": "actual question"}},
        {
            "type": "response_item",
            "payload": {
                "type": "function_call",
                "namespace": "mcp__demo",
                "name": "read",
                "call_id": "call",
                "arguments": '{"path":"marker"}',
            },
        },
        {
            "type": "response_item",
            "payload": {
                "type": "function_call_output",
                "call_id": "call",
                "output": {"content": [{"type": "input_text", "text": "marker"}], "success": True},
            },
        },
        {
            "type": "event_msg",
            "payload": {"type": "item_completed", "item": {"type": "CommandExecution"}},
        },
        {
            "type": "response_item",
            "payload": {
                "type": "custom_tool_call",
                "name": "missing",
                "call_id": "unfinished",
                "input": "ignored",
            },
        },
    )
    report = invoke("history", path)
    assert report.returncode == 0, report.stderr
    assert json.loads(report.stdout)["tools"] == {
        "mcp__demo.read": {"calls": 1, "ok": 1, "error": 0, "unknown": 0, "missing": 0},
        "missing": {"calls": 1, "ok": 0, "error": 0, "unknown": 0, "missing": 1},
    }
    messages = invoke("history", path, "--view", "messages", "--details")
    assert messages.returncode == 0, messages.stderr
    assert [row["text"] for row in json.loads(messages.stdout)["events"]] == ["actual question"]


def test_unknown_log_is_rejected(tmp_path: Path) -> None:
    path = write_log(tmp_path / "unknown.jsonl", {"type": "unknown"})
    result = invoke("history", path)
    assert result.returncode != 0
    assert "unsupported session header" in result.stderr
    assert result.stdout == ""


def test_history_paginates_complete_lines_and_reports_partial_tail(tmp_path: Path) -> None:
    path = tmp_path / "pi.jsonl"
    _ = write_log(
        path,
        {"type": "session", "id": "session-pi", "version": 1},
        {
            "type": "message",
            "message": {
                "role": "assistant",
                "content": [
                    {"type": "text", "text": "hello"},
                    {
                        "type": "toolCall",
                        "id": "c",
                        "name": "read",
                        "arguments": {"path": "marker"},
                    },
                ],
            },
        },
        {"type": "custom_message", "customType": "hook", "content": "context note"},
    )
    with path.open("a") as stream:
        _ = stream.write('{"type":')
    first = invoke("history", str(path), "--view", "events", "--limit", "1")
    assert first.returncode == 0, first.stderr
    page = json.loads(first.stdout)
    assert page["nextAfterLine"] == 2
    assert page["incompleteLine"] == 4
    assert [event["kind"] for event in page["events"]] == ["message", "tool_call"]
    second = invoke("history", str(path), "--view", "events", "--after-line", "2")
    assert second.returncode == 0, second.stderr
    events = json.loads(second.stdout)["events"]
    assert len(events) == 1
    assert events[0]["customType"] == "hook"
    assert "context note" not in second.stdout


def test_run_copies_inputs_and_uses_private_pi_config(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    host = tmp_path / "host"
    host.mkdir()
    _ = (host / "auth.json").write_text("native login fixture")
    _ = (host / "settings.json").write_text('{"personalConfig":true}')
    fixture = tmp_path / "test files"
    fixture.mkdir()
    _ = (fixture / "marker").write_text("literal file")
    context = tmp_path / "baseline & instructions.md"
    _ = context.write_text("explicit context")
    fake = tmp_path / "pi"
    _ = fake.write_text(f"""#!{sys.executable}
import json, os, pathlib, sys
if sys.argv[1:] == ["--version"]:
    print("test-pi")
    raise SystemExit(0)
args = sys.argv[1:]
agent = pathlib.Path(os.environ["PI_CODING_AGENT_DIR"])
assert set(("--no-context-files", "--no-skills", "--no-extensions", "--no-mcp")) <= set(args)
assert json.loads((agent / "settings.json").read_text())["transport"] == "sse"
assert (agent / "auth.json").read_text() == "native login fixture"
assert args[args.index("--") + 1:] == ["- literal ; $(echo no)"]
assert pathlib.Path(args[args.index("--append-system-prompt") + 1]).read_text() == "explicit context"
assert pathlib.Path("marker").read_text() == "literal file"
pathlib.Path("marker").write_text("changed in trial")
sessions = pathlib.Path(args[args.index("--session-dir") + 1])
(sessions / "new.jsonl").write_text(json.dumps({{"type": "session", "id": "fake", "version": 3}}) + "\\n")
""")
    fake.chmod(0o700)
    monkeypatch.setenv("PATH", f"{tmp_path}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.setenv("PI_CODING_AGENT_DIR", str(host))
    monkeypatch.setenv("TMPDIR", str(tmp_path))
    result = invoke(
        "run",
        "--prompt=- literal ; $(echo no)",
        "--fixture",
        str(fixture),
        "--context",
        str(context),
    )
    assert result.returncode == 0, result.stderr
    report = json.loads(result.stdout)
    root = Path(report["directory"])
    assert report["status"] == "completed"
    assert report["piVersion"] == "test-pi"
    assert root.stat().st_mode & 0o777 == 0o700
    assert (root / "inputs/context-01.md").read_text() == "explicit context"
    assert (fixture / "marker").read_text() == "literal file"
    assert (host / "settings.json").read_text() == '{"personalConfig":true}'
    assert not (root / "agent/auth.json").is_symlink()
    history = invoke("history", str(root))
    assert history.returncode == 0, history.stderr
    assert json.loads(history.stdout)["sessionId"] == "fake"

    rejected = invoke("run", "--prompt=@unexpected-file")
    assert rejected.returncode != 0
    assert rejected.stdout == ""
    assert "leading @" in rejected.stderr


def test_public_launcher_works_outside_checkout(tmp_path: Path) -> None:
    launcher = CLI.parents[1] / "bin/slopsentral-audit"
    result = subprocess.run(
        [str(launcher), "--help"],
        cwd=tmp_path,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "slopsentral-audit" in result.stdout
    assert list(tmp_path.iterdir()) == []


def test_public_launcher_passes_alternate_uv_config(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    launcher = CLI.parents[1] / "bin/slopsentral-audit"
    config = tmp_path / "company uv.toml"
    monkeypatch.setenv("UV_CONFIG_FILE", str(config))
    monkeypatch.setenv("UV_SYSTEM_CERTS", "true")
    _ = config.write_text("offline = true\nno-build = true\n")
    result = subprocess.run(
        [str(launcher), "--help"],
        cwd=tmp_path,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "slopsentral-audit" in result.stdout

    _ = config.write_text('required-version = "==0.0.0"\n')
    rejected = subprocess.run(
        [str(launcher), "--help"],
        cwd=tmp_path,
        text=True,
        capture_output=True,
        check=False,
    )
    assert rejected.returncode != 0
    assert rejected.stdout == ""
    assert "0.0.0" in rejected.stderr
