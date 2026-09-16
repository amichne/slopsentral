#!/usr/bin/env python3
"""Bridge a Codex session event to the installed Slopsentral profile CLI.

Runtime dependency: npm install --global github:amichne/slopsentral#main.
Profile selection and configuration writes remain owned by the portable CLI.
"""

import json
import shutil
import subprocess
import sys


def warning(reason):
    return {"systemMessage": f"Repository profile activation: {reason}."}


def run(payload, executable):
    if len(payload) > 64 * 1024:
        return warning("INVALID_HOOK_INPUT")
    if executable is None:
        return warning("SLOPSENTRAL_CLI_MISSING; install the Slopsentral npm CLI")
    try:
        result = subprocess.run(
            [executable, "context", "hook"], input=payload,
            capture_output=True, timeout=45, check=False,
        )
    except subprocess.TimeoutExpired:
        return warning("CONTEXT_COMMAND_TIMED_OUT")
    except OSError:
        return warning("CONTEXT_COMMAND_UNAVAILABLE")
    if result.returncode != 0 or len(result.stdout) > 4096:
        return warning("CONTEXT_COMMAND_FAILED")
    try:
        output = json.loads(result.stdout)
    except (ValueError, UnicodeError):
        return warning("INVALID_CONTEXT_OUTPUT")
    if output == {}:
        return output
    if (isinstance(output, dict) and set(output) == {"systemMessage"}
            and isinstance(output["systemMessage"], str)
            and len(output["systemMessage"]) <= 512):
        return output
    return warning("INVALID_CONTEXT_OUTPUT")


if __name__ == "__main__":
    event = sys.stdin.buffer.read(64 * 1024 + 1)
    print(json.dumps(run(event, shutil.which("slopsentral"))))
