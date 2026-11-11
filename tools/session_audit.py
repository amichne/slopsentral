"""Start focused Pi sessions and inspect Pi or Codex history."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from time import monotonic_ns

from audit_history import HistoryError, Json, Record, Source, history_view, load_history

DEFAULT_MODEL = "openai-codex/gpt-6-luna"
DEFAULT_SYSTEM = (
    "Complete the task in the user message. Use only the tools needed to establish evidence. "
    "Report the result and blockers concisely."
)
SESSION_ID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$")
VIEWS = ("summary", "tools", "messages", "context", "usage", "events")


@dataclass(frozen=True)
class SessionFile:
    source: Source
    identity: str
    path: Path
    modified_ns: int

    def view(self) -> Record:
        return {
            "source": self.source,
            "sessionId": self.identity,
            "path": str(self.path),
            "modifiedNs": self.modified_ns,
        }


def agent_home() -> Path:
    return Path(os.environ.get("PI_CODING_AGENT_DIR") or Path.home() / ".pi/agent").expanduser()


def discover(source: str = "all") -> list[SessionFile]:
    codex_home = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex").expanduser()
    roots = (
        (Source.PI, agent_home() / "sessions", "*.jsonl"),
        (Source.CODEX, codex_home / "sessions", "rollout-*.jsonl*"),
        (Source.CODEX, codex_home / "archived_sessions", "rollout-*.jsonl*"),
    )
    found: list[SessionFile] = []
    for host, root, pattern in roots:
        if source not in ("all", host):
            continue
        for path in root.rglob(pattern):
            if not path.name.endswith((".jsonl", ".jsonl.zst")):
                continue
            stem = path.name.removesuffix(".zst").removesuffix(".jsonl")
            match = SESSION_ID.search(stem)
            if match:
                try:
                    modified = path.stat().st_mtime_ns
                except FileNotFoundError:
                    continue  # A native archive operation can move the file.
                found.append(SessionFile(host, match[0], path.absolute(), modified))
    return sorted(found, key=lambda session: (-session.modified_ns, str(session.path)))


def resolve_history(target: str) -> Path:
    path = Path(target).expanduser()
    if path.is_file():
        return path.resolve()
    if path.is_dir():
        sessions = sorted((path / "sessions").glob("*.jsonl"))
        if len(sessions) == 1:
            return sessions[0]
        msg = f"expected one Pi session in {path / 'sessions'}; select a session file explicitly"
        raise HistoryError(msg)
    if re.fullmatch("[0-9a-f-]{8,36}", target.lower()):
        matches = [session for session in discover() if session.identity.startswith(target.lower())]
        if len(matches) == 1:
            return matches[0].path
        if matches:
            msg = f"ambiguous session id: {target}; select a session file explicitly"
            raise HistoryError(msg)
    msg = f"session file, run directory, or session id not found: {target}"
    raise HistoryError(msg)


def positive(value: str) -> int:
    number = int(value)
    if number < 1:
        msg = "expected a positive integer"
        raise argparse.ArgumentTypeError(msg)
    return number


def nonnegative(value: str) -> int:
    number = int(value)
    if number < 0:
        msg = "expected a nonnegative integer"
        raise argparse.ArgumentTypeError(msg)
    return number


def existing_path(value: str) -> Path:
    try:
        return Path(value).expanduser().resolve(strict=True)
    except OSError as error:
        raise argparse.ArgumentTypeError(str(error)) from error


@dataclass(frozen=True)
class Run:
    model: str
    thinking: str
    system_prompt: Path | None
    contexts: tuple[Path, ...]
    resources: tuple[tuple[str, Path], ...]
    tools: str
    prompt: str | None
    fixture: Path | None
    interactive: bool
    timeout: int

    @classmethod
    def parse(cls, args: argparse.Namespace) -> Run:
        model: str = args.model
        thinking: str = args.thinking
        system: Path | None = args.system_prompt
        contexts: list[Path] = args.context
        extensions: list[Path] = args.extension
        skills: list[Path] = args.skill
        plugins: list[Path] = args.plugin
        tools: str = args.tools
        prompt: str | None = args.prompt
        prompt_file: Path | None = args.prompt_file
        fixture: Path | None = args.fixture
        interactive: bool = args.interactive
        timeout: int = args.timeout
        if prompt_file is not None:
            prompt = prompt_file.read_text(encoding="utf-8")
        if not interactive and (prompt is None or not prompt.strip()):
            msg = "a headless run needs --prompt or --prompt-file"
            raise HistoryError(msg)
        if prompt is not None and (prompt.startswith("@") or "\0" in prompt):
            msg = "Pi treats a leading @ as a file argument; prompt text must also omit NUL"
            raise HistoryError(msg)
        if interactive and not (sys.stdin.isatty() and sys.stdout.isatty()):
            msg = "--interactive needs a terminal"
            raise HistoryError(msg)
        if any(not path.is_dir() or not (path / "package.json").is_file() for path in plugins):
            msg = "--plugin needs a local Pi package directory with package.json"
            raise HistoryError(msg)
        if fixture is not None and (
            not fixture.is_dir() or any(path.is_symlink() for path in fixture.rglob("*"))
        ):
            msg = "--fixture needs a directory without symlinks"
            raise HistoryError(msg)
        return cls(
            model,
            thinking,
            system,
            tuple(contexts),
            tuple(
                [("plugin", path) for path in plugins]
                + [("extension", path) for path in extensions]
                + [("skill", path) for path in skills]
            ),
            tools,
            prompt,
            fixture,
            interactive,
            timeout,
        )


def write_json(path: Path, data: Record) -> None:
    _ = path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def copy_input(path: Path, content: str) -> Record:
    data = content.encode()
    _ = path.write_bytes(data)
    return {"file": path.name, "sha256": hashlib.sha256(data).hexdigest()}


def stage_inputs(inputs: Path, spec: Run) -> tuple[Path, list[Path], list[Record]]:
    system = inputs / "system.md"
    prompt = (
        DEFAULT_SYSTEM
        if spec.system_prompt is None
        else spec.system_prompt.read_text(encoding="utf-8")
    )
    records = [copy_input(system, prompt)]
    contexts: list[Path] = []
    for index, context in enumerate(spec.contexts, 1):
        staged = inputs / f"context-{index:02}.md"
        records.append(
            {**copy_input(staged, context.read_text(encoding="utf-8")), "source": str(context)}
        )
        contexts.append(staged)
    if spec.prompt is not None:
        records.append(copy_input(inputs / "prompt.md", spec.prompt))
    return system, contexts, records


def pi_command(
    executable: str,
    spec: Run,
    system: Path,
    contexts: list[Path],
    sessions: Path,
) -> list[str]:
    command = [
        executable,
        "--offline",
        "--no-approve",
        "--no-context-files",
        "--no-skills",
        "--no-extensions",
        "--no-mcp",
        "--no-prompt-templates",
        "--no-themes",
        "--model",
        spec.model,
        "--thinking",
        spec.thinking,
        "--session-dir",
        str(sessions),
        "--system-prompt",
        str(system),
    ]
    command.extend(["--no-tools"] if spec.tools == "none" else ["--tools", spec.tools])
    for context in contexts:
        command.extend(["--append-system-prompt", str(context)])
    for kind, resource in spec.resources:
        command.extend(["--skill" if kind == "skill" else "--extension", str(resource)])
    if not spec.interactive:
        command.append("--print")
    if spec.prompt is not None:
        command.extend(["--", spec.prompt])
    return command


def prepare_pi(root: Path, spec: Run) -> tuple[Path, list[Path], list[Record], dict[str, str]]:
    inputs, agent, work, sessions = (
        root / name for name in ("inputs", "agent", "work", "sessions")
    )
    for directory in (inputs, agent, work, sessions):
        directory.mkdir()
    if spec.fixture is not None:
        if root.is_relative_to(spec.fixture):
            msg = "--fixture cannot contain the temporary run directory"
            raise HistoryError(msg)
        _ = shutil.copytree(spec.fixture, work, dirs_exist_ok=True)
    system, contexts, records = stage_inputs(inputs, spec)
    write_json(
        agent / "settings.json",
        {
            "compaction": {"enabled": False},
            "retry": {"enabled": False, "provider": {"maxRetries": 0}},
            "transport": "sse",
        },
    )
    host = agent_home().resolve()
    if (host / "models.json").is_file():
        _ = shutil.copyfile(host / "models.json", agent / "models.json")
    if (host / "auth.json").is_file():
        (agent / "auth.json").symlink_to((host / "auth.json").resolve())
    bin_dir = Path(__file__).resolve().parents[1] / "bin"
    path = os.pathsep.join((str(bin_dir), os.environ.get("PATH", os.defpath)))
    return (
        system,
        contexts,
        records,
        {**os.environ, "PI_CODING_AGENT_DIR": str(agent), "PATH": path},
    )


def launch_pi(command: list[str], root: Path, env: dict[str, str], spec: Run) -> int:
    work = root / "work"
    if spec.interactive:
        return subprocess.run(command, cwd=work, env=env, check=False).returncode
    with (
        (root / "stdout.log").open("w", encoding="utf-8") as output,
        (root / "stderr.log").open("w", encoding="utf-8") as errors,
        subprocess.Popen(
            command,
            cwd=work,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=output,
            stderr=errors,
            start_new_session=True,
        ) as process,
    ):
        try:
            return process.wait(timeout=spec.timeout)
        except (subprocess.TimeoutExpired, KeyboardInterrupt):
            with suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGKILL)
            raise


def run_pi(spec: Run) -> tuple[Record, int]:
    executable = shutil.which("pi")
    if executable is None:
        msg = "pi is missing from PATH"
        raise HistoryError(msg)
    root = Path(tempfile.mkdtemp(prefix="slopsentral-audit-")).resolve()
    print(f"Pi audit directory: {root}", file=sys.stderr, flush=True)
    sessions = root / "sessions"
    report: Record = {
        "schemaVersion": 1,
        "directory": str(root),
        "model": spec.model,
        "thinking": spec.thinking,
        "tools": spec.tools,
        "fixture": str(spec.fixture) if spec.fixture else None,
        "transport": "sse",
        "resources": [{"kind": kind, "path": str(path)} for kind, path in spec.resources],
        "status": "running",
    }
    status = 1
    start = monotonic_ns()
    try:
        system, contexts, inputs, env = prepare_pi(root, spec)
        input_records: list[Json] = [*inputs]
        report["inputs"] = input_records
        write_json(root / "run.json", report)
        version = subprocess.run(
            [executable, "--version"],
            cwd=root / "work",
            env=env,
            capture_output=True,
            text=True,
            timeout=15,
            check=True,
        )
        report["piVersion"] = version.stdout.strip()
        command = pi_command(executable, spec, system, contexts, sessions)
        start = monotonic_ns()
        status = launch_pi(command, root, env, spec)
        report["status"] = "completed" if status == 0 else "failed"
    except subprocess.TimeoutExpired:
        status = 124
        report["status"] = "timeout"
    except KeyboardInterrupt:
        status = 130
        report["status"] = "interrupted"
    except (HistoryError, OSError, UnicodeError, subprocess.CalledProcessError) as error:
        report["status"] = "launch_failed"
        print(f"slopsentral-audit: {error}", file=sys.stderr)
    finally:
        (root / "agent/auth.json").unlink(missing_ok=True)
        report["elapsedMs"] = (monotonic_ns() - start) // 1_000_000
        report["exitCode"] = status
        report["sessions"] = [str(path) for path in sorted(sessions.glob("*.jsonl"))]
        if status == 0 and not report["sessions"]:
            status = 1
            report.update(status="no_session", exitCode=status)
        write_json(root / "run.json", report)
    return report, status if status >= 0 else 128 - status


def command_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="slopsentral-audit", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    sessions = commands.add_parser(
        "sessions", help="List recent local sessions without message bodies."
    )
    _ = sessions.add_argument("--source", choices=("all", *Source), default="all")
    _ = sessions.add_argument("--limit", type=positive, default=20)
    history = commands.add_parser(
        "history", help="Read a session file, audit directory, or session ID."
    )
    _ = history.add_argument("target")
    _ = history.add_argument("--view", choices=VIEWS, default="summary")
    _ = history.add_argument(
        "--details", action="store_true", help="Include selected message and tool bodies."
    )
    _ = history.add_argument("--limit", type=positive, default=50)
    _ = history.add_argument("--after-line", type=nonnegative, default=0)
    _ = history.add_argument(
        "--leaf", help="Select a Pi entry ID instead of the last persisted entry."
    )
    run = commands.add_parser("run", help="Start Pi in a private temporary directory.")
    prompts = run.add_mutually_exclusive_group()
    _ = prompts.add_argument("--prompt")
    _ = prompts.add_argument("--prompt-file", type=existing_path)
    _ = run.add_argument(
        "--model", default=DEFAULT_MODEL, help=f"Pi model selector (default: {DEFAULT_MODEL})."
    )
    _ = run.add_argument(
        "--thinking",
        choices=("off", "minimal", "low", "medium", "high", "xhigh", "max"),
        default="low",
    )
    _ = run.add_argument("--system-prompt", type=existing_path)
    _ = run.add_argument("--context", type=existing_path, action="append", default=[])
    _ = run.add_argument("--plugin", type=existing_path, action="append", default=[])
    _ = run.add_argument("--skill", type=existing_path, action="append", default=[])
    _ = run.add_argument("--extension", type=existing_path, action="append", default=[])
    _ = run.add_argument(
        "--tools", default="read", help="Pi tool allowlist or none (default: read)."
    )
    _ = run.add_argument(
        "--fixture", type=existing_path, help="Copy this directory into the temporary workspace."
    )
    _ = run.add_argument("--interactive", action="store_true")
    _ = run.add_argument(
        "--timeout", type=positive, default=180, help="Headless timeout in seconds (default: 180)."
    )
    return parser


def main() -> int:
    args = command_parser().parse_args()
    try:
        status = 0
        match args.command:
            case "sessions":
                source: str = args.source
                limit: int = args.limit
                result: Record = {
                    "sessions": [session.view() for session in discover(source)[:limit]]
                }
            case "history":
                target: str = args.target
                leaf: str | None = args.leaf
                result = history_view(
                    load_history(resolve_history(target), leaf),
                    args.view,
                    args.after_line,
                    args.limit,
                    details=args.details,
                )
            case "run":
                result, status = run_pi(Run.parse(args))
            case _:
                return 2
        print(json.dumps(result, ensure_ascii=True))
    except (HistoryError, OSError, UnicodeError) as error:
        print(f"slopsentral-audit: {error}", file=sys.stderr)
        return 1
    return status


if __name__ == "__main__":
    raise SystemExit(main())
