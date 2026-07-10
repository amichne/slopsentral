from __future__ import annotations

import json
import re
from typing import Any


RAW_GITHUB_COMMAND = re.compile(
    r"(?<![A-Za-z0-9_-])gh\s+"
    r"(?:api|auth|issue|pr|release|repo|run|secret|variable|workflow)\b"
)


def guard_output(payload: dict[str, Any]) -> dict[str, Any] | None:
    tool_name = str(payload.get("tool_name") or payload.get("toolName") or "")
    normalized_tool = tool_name.lower()
    if normalized_tool.startswith("mcp__") and "github" in normalized_tool:
        return deny("Use npx -y gh-axi as the sole GitHub interaction surface.")
    command = hook_command(payload)
    if command and RAW_GITHUB_COMMAND.search(command):
        return deny("Raw gh is disabled; use npx -y gh-axi and arm the AXI observer.")
    return None


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
    raw_input = payload.get("tool_input") or payload.get("toolInput") or {}
    if isinstance(raw_input, str):
        try:
            raw_input = json.loads(raw_input)
        except json.JSONDecodeError:
            return raw_input
    if not isinstance(raw_input, dict):
        return ""
    for key in ("command", "cmd", "bash"):
        value = raw_input.get(key)
        if isinstance(value, str):
            return value
    return ""
