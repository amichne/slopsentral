#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Mapping, Sequence


NUMBER_PATTERN = re.compile(r"-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$")


class UsageError(Exception):
    pass


class AxiParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise UsageError(message)


def encode_string(value: object) -> str:
    text = str(value)
    if (
        text
        and text == text.strip()
        and text not in {"true", "false", "null"}
        and not NUMBER_PATTERN.fullmatch(text)
        and not text.startswith("-")
        and not any(character in text for character in ',:[]{}"\\\n\r\t')
        and all(ord(character) >= 0x20 for character in text)
    ):
        return text
    return json.dumps(text, ensure_ascii=False)


def emit(payload: Mapping[str, Any]) -> None:
    lines: list[str] = []
    for key, value in payload.items():
        if isinstance(value, bool):
            lines.append(f"{key}: {'true' if value else 'false'}")
        elif isinstance(value, (int, float)):
            lines.append(f"{key}: {value}")
        elif value is None:
            lines.append(f"{key}: null")
        elif isinstance(value, list):
            lines.append(f"{key}[{len(value)}]: " + ",".join(encode_string(item) for item in value))
        else:
            lines.append(f"{key}: {encode_string(value)}")
    sys.stdout.write("\n".join(lines))


def build_parser() -> AxiParser:
    parser = AxiParser(description="Run one Pkl repository proof through the pkl-engineering façade", allow_abbrev=False)
    parser.add_argument("--repo", type=Path, default=Path("."))
    parser.add_argument("--check", required=True, choices=("format", "evaluate", "test"))
    parser.add_argument("--agent-bin", type=Path, default=os.environ.get("PKL_AGENT_BIN"))
    parser.add_argument("--timeout", type=int, default=300)
    return parser


def changed_files(repo: Path) -> list[str]:
    configured = os.environ.get("INTELLIGENCE_CHANGED_FILES")
    if configured is not None:
        return sorted(
            {
                item.strip().replace("\\", "/")
                for item in re.split(r"[\n,]", configured)
                if item.strip()
            }
        )
    inside = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "--is-inside-work-tree"],
        text=True,
        capture_output=True,
        check=False,
    )
    if inside.returncode != 0 or inside.stdout.strip() != "true":
        return []
    commands = (
        ("diff", "--name-only", "HEAD", "--"),
        ("diff", "--name-only", "--cached", "--"),
        ("ls-files", "--others", "--exclude-standard"),
    )
    paths: set[str] = set()
    for command in commands:
        completed = subprocess.run(
            ["git", "-C", str(repo), *command],
            text=True,
            capture_output=True,
            check=False,
        )
        if completed.returncode == 0:
            paths.update(line.strip() for line in completed.stdout.splitlines() if line.strip())
    return sorted(paths)


def pkl_owned_paths(repo: Path, changed: Sequence[str]) -> list[str]:
    owned: list[str] = []
    for relative in changed:
        normalized = relative.replace("\\", "/")
        candidate = (repo / normalized).resolve()
        try:
            candidate.relative_to(repo)
        except ValueError:
            continue
        if not candidate.is_file():
            continue
        if candidate.suffix == ".pkl" or candidate.name in {"PklProject", "PklProject.deps.json"}:
            owned.append(normalized)
    return owned


def entrypoints(repo: Path) -> list[str]:
    configured = os.environ.get("INTELLIGENCE_PKL_ENTRYPOINTS")
    if configured is not None:
        lines = re.split(r"[\n,]", configured)
    else:
        path = repo / ".intelligence" / "pkl-entrypoints"
        if not path.is_file():
            return []
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    values: list[str] = []
    for raw in lines:
        value = raw.strip()
        if not value or value.startswith("#"):
            continue
        candidate = (repo / value).resolve()
        try:
            candidate.relative_to(repo)
        except ValueError as error:
            raise UsageError(f"Pkl entrypoint is outside the repository: {value}") from error
        if not candidate.is_file():
            raise UsageError(f"Pkl entrypoint does not exist: {value}")
        values.append(value.replace("\\", "/"))
    return list(dict.fromkeys(values))


def resolve_agent_bin(value: Path | None) -> Path:
    candidate = value.expanduser().resolve() if value else Path(__file__).resolve().parent.parent / "skills" / "pkl-engineering" / "scripts" / "pkl_agent"
    if not candidate.is_file() or not os.access(candidate, os.X_OK):
        raise UsageError(f"pkl-engineering façade is missing or not executable: {candidate}")
    return candidate


def invoke(command: Sequence[str], timeout: int) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            list(command),
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f"Pkl {command[-1]} check exceeded {timeout} seconds") from error


def run_check(args: argparse.Namespace) -> int:
    repo = args.repo.expanduser().resolve()
    if not repo.is_dir():
        raise UsageError(f"repository does not exist or is not a directory: {repo}")
    owned = pkl_owned_paths(repo, changed_files(repo))
    if not owned:
        emit({"check": args.check, "status": "skipped", "reason": "no changed Pkl-owned files"})
        return 0
    agent = resolve_agent_bin(args.agent_bin)
    command = [str(agent), "--workspace", str(repo)]
    checked = len(owned)
    if args.check == "format":
        format_targets = [
            path
            for path in owned
            if path.endswith(".pkl") or Path(path).name == "PklProject"
        ]
        if not format_targets:
            emit(
                {
                    "check": "format",
                    "status": "skipped",
                    "reason": "changed Pkl files do not include formatter-owned sources",
                }
            )
            return 0
        checked = len(format_targets)
        command.extend(["format", "check", *format_targets])
    elif args.check == "evaluate":
        modules = entrypoints(repo)
        if not modules:
            emit(
                {
                    "check": "evaluate",
                    "status": "skipped",
                    "reason": "no explicit evaluation roots",
                    "help": ["List directly evaluable modules in .intelligence/pkl-entrypoints"],
                }
            )
            return 0
        checked = len(modules)
        command.extend(["module", "validate", *modules])
    else:
        tests = [path for path in owned if path.endswith((".test.pkl", "_test.pkl"))]
        if not (repo / "PklProject").exists() and not tests:
            emit(
                {
                    "check": "test",
                    "status": "skipped",
                    "reason": "no PklProject or changed Pkl test modules",
                }
            )
            return 0
        command.extend(["test", "run", *([] if (repo / "PklProject").exists() else tests)])
        checked = len(tests)
    completed = invoke(command, args.timeout)
    detail = (completed.stdout or completed.stderr).strip()
    if completed.returncode != 0:
        emit(
            {
                "check": args.check,
                "status": "failed",
                "checked": checked,
                "diagnostic": detail[:1200] or "Pkl check failed without diagnostics",
            }
        )
        return 1
    emit(
        {
            "check": args.check,
            "status": "passed",
            "checked": checked,
            "proof": detail[:1200] or "Pkl façade completed successfully",
        }
    )
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
        return run_check(args)
    except UsageError as error:
        emit({"error": str(error), "help": "Run `pkl-check.py --help` for valid flags"})
        return 2
    except (OSError, RuntimeError) as error:
        emit({"error": str(error), "help": "Inspect the Pkl installation and repository configuration"})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
