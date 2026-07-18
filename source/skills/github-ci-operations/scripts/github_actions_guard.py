from __future__ import annotations

import json
import re
from typing import Any


BYPASS_GITHUB_COMMAND = re.compile(
    r"(?<![A-Za-z0-9_-])(?:"
    r"env(?:\s+[A-Za-z_][A-Za-z0-9_]*=[^\s;&|]+)*\s+gh|"
    r"command(?:\s+--)?\s+gh|"
    r"/(?:[A-Za-z0-9._-]+/)*gh"
    r")(?=\s|$)"
)
GH_REDIRECT = 'gh() { npx -y gh-axi "$@"; }'
SHELL_TOOLS = frozenset(("bash", "exec_command"))


def guard_output(payload: dict[str, Any]) -> dict[str, Any] | None:
    tool_name = str(payload.get("tool_name") or payload.get("toolName") or "")
    normalized_tool = tool_name.lower()
    if normalized_tool.startswith("mcp__") and "github" in normalized_tool:
        return deny("Use npx -y gh-axi as the sole GitHub interaction surface.")
    command = hook_command(payload)
    if command and BYPASS_GITHUB_COMMAND.search(command):
        return deny("This shell form bypasses AXI redirection; use npx -y gh-axi directly.")
    if command and normalized_tool in SHELL_TOOLS:
        return redirect(payload, command)
    return None


def redirect(payload: dict[str, Any], command: str) -> dict[str, Any]:
    updated_input = hook_input(payload)
    updated_input.pop("cmd", None)
    updated_input.pop("bash", None)
    updated_input["command"] = f"{GH_REDIRECT}\n{command}"
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "updatedInput": updated_input,
        }
    }


def deny(message: str) -> dict[str, Any]:
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": message,
        },
        "systemMessage": message,
    }


def hook_command(payload: dict[str, Any]) -> str:
    raw_input = hook_input(payload)
    for key in ("command", "cmd", "bash"):
        value = raw_input.get(key)
        if isinstance(value, str):
            return value
    return ""


def hook_input(payload: dict[str, Any]) -> dict[str, Any]:
    raw_input = payload.get("tool_input") or payload.get("toolInput") or {}
    if isinstance(raw_input, str):
        try:
            raw_input = json.loads(raw_input)
        except json.JSONDecodeError:
            return {"command": raw_input}
    if not isinstance(raw_input, dict):
        return {}
    return dict(raw_input)
