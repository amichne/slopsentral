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
"""Install the canonical scope hook into user configuration with immutable code."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shlex
import tempfile
import tomllib
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import TypeGuard


class Code(StrEnum):
    INVALID_CONFIG = "INVALID_CONFIG"
    HOOKS_DISABLED = "HOOKS_DISABLED"
    RUNTIME_CHANGED = "RUNTIME_CHANGED"
    IO_FAILED = "IO_FAILED"


@dataclass(frozen=True)
class Rejected:
    code: Code


def mapping(value: object) -> TypeGuard[dict[str, object]]:
    return isinstance(value, dict)


def sequence(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def write(file: Path, data: bytes) -> None:
    with tempfile.NamedTemporaryFile(dir=file.parent, delete=False) as stream:
        temporary = Path(stream.name)
        _ = stream.write(data)
    try:
        _ = temporary.replace(file)
    finally:
        temporary.unlink(missing_ok=True)


def groups(value: object, replacement: str | None) -> list[object] | Rejected:
    if not sequence(value):
        return Rejected(Code.INVALID_CONFIG)
    result: list[object] = []
    for group in value:
        if not mapping(group):
            return Rejected(Code.INVALID_CONFIG)
        handlers = group.get("hooks")
        if not sequence(handlers):
            return Rejected(Code.INVALID_CONFIG)
        kept: list[object] = []
        for item in handlers:
            if not mapping(item):
                return Rejected(Code.INVALID_CONFIG)
            command = item.get("command")
            if replacement is not None:
                kept.append({**item, "command": replacement})
            elif not isinstance(command, str) or "agents-md-scope.py" not in command:
                kept.append(item)
        if kept:
            result.append({**group, "hooks": kept})
    return result


def merge(existing: object, adapter: object, command: str) -> dict[str, object] | Rejected:
    if not mapping(existing) or not mapping(adapter):
        return Rejected(Code.INVALID_CONFIG)
    hooks, additions = existing.get("hooks"), adapter.get("hooks")
    if not mapping(hooks) or not mapping(additions):
        return Rejected(Code.INVALID_CONFIG)
    merged = dict(hooks)
    if "PostToolUse" in merged:
        previous = groups(merged["PostToolUse"], None)
        if isinstance(previous, Rejected):
            return previous
        if previous:
            merged["PostToolUse"] = previous
        else:
            del merged["PostToolUse"]
    for event, entries in additions.items():
        previous, fresh = groups(merged.get(event, []), None), groups(entries, command)
        if isinstance(previous, Rejected) or isinstance(fresh, Rejected):
            return Rejected(Code.INVALID_CONFIG)
        merged[event] = [*previous, *fresh]
    return {**existing, "hooks": merged}


def install(codex_home: Path) -> dict[str, object] | Rejected:
    root = Path(__file__).resolve().parents[1]
    config = tomllib.loads((codex_home / "config.toml").read_text())
    features: object = config.get("features")
    if not mapping(features) or features.get("hooks") is not True:
        return Rejected(Code.HOOKS_DISABLED)
    source = root / "source/hooks/agents-md-scope.py"
    code, lock = source.read_bytes(), source.with_suffix(".py.lock").read_bytes()
    digest = hashlib.sha256(code + b"\0" + lock).hexdigest()
    runtime = codex_home / "hook-runtimes/agents-md-scope" / digest
    target = runtime / source.name
    command = shlex.join(["uv", "run", "--locked", "--script", str(target)])
    hooks_file = codex_home / "hooks.json"
    original = hooks_file.read_bytes() if hooks_file.exists() else b'{"hooks":{}}\n'
    adapter = json.loads((root / "source/hooks/codex/agents-md-scope.hooks.json").read_bytes())
    merged = merge(json.loads(original), adapter, command)
    if isinstance(merged, Rejected):
        return merged
    replacement = (json.dumps(merged, indent=2) + "\n").encode()
    runtime.mkdir(parents=True, exist_ok=True)
    for destination, data in ((target, code), (target.with_suffix(".py.lock"), lock)):
        if destination.is_symlink() or (destination.exists() and destination.read_bytes() != data):
            return Rejected(Code.RUNTIME_CHANGED)
        if not destination.exists():
            write(destination, data)
    changed = original != replacement
    if changed:
        backup = codex_home / (
            "hooks.json.before-agents-md-scope-" + hashlib.sha256(original).hexdigest()
        )
        if not backup.exists():
            write(backup, original)
        write(hooks_file, replacement)
    return {
        "type": "INSTALLED",
        "changed": changed,
        "hooks": str(hooks_file),
        "runtime": str(target),
        "sha256": hashlib.sha256(code).hexdigest(),
        "trust": "PENDING_HOST_REVIEW",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument(
        "--codex-home",
        type=Path,
        default=Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex"))),
    )
    args = parser.parse_args()
    try:
        result = install(args.codex_home.resolve())
    except (json.JSONDecodeError, tomllib.TOMLDecodeError):
        result = Rejected(Code.INVALID_CONFIG)
    except OSError:
        result = Rejected(Code.IO_FAILED)
    if isinstance(result, Rejected):
        print(json.dumps({"type": "INSTALL_REJECTED", "reason": result.code.value}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
