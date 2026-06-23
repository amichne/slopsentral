#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Any


STATE_VERSION = 1
DEFAULT_STATE_DIR = ".agent-turn/kotlin-agentic-correctness"
SCORE_VALUES = ("Pass", "Concern", "Fail")
SCORE_DIMENSIONS = (
    "domain_fidelity",
    "boundary_parsing",
    "layout_cohesion",
    "error_design",
    "state_safety",
    "test_value",
    "kotlin_idiom",
    "filesystem_evidence",
    "kast_semantics",
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Manage file-backed state for Kotlin agentic correctness work."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    init = subparsers.add_parser("init", help="Create a new session directory.")
    init.add_argument("--repo", default=".", help="Repository root.")
    init.add_argument("--state-dir", default=DEFAULT_STATE_DIR, help="State directory.")
    init.add_argument("--session-name", default="session", help="Human-readable session slug.")
    init.set_defaults(func=init_session)

    diagnostics = subparsers.add_parser(
        "diagnostics-request",
        help="Write a raw/diagnostics Kast JSON-RPC request file.",
    )
    diagnostics.add_argument("--repo", default=".", help="Repository root.")
    diagnostics.add_argument("--file", action="append", default=[], help="Kotlin file path. May repeat.")
    diagnostics.add_argument("--output", required=True, help="Request file to write.")
    diagnostics.add_argument("--id", type=int, default=1, help="JSON-RPC id.")
    diagnostics.set_defaults(func=write_diagnostics_request)

    intent = subparsers.add_parser("intent", help="Write a Kotlin turn intent JSON file.")
    intent.add_argument("--repo", default=".", help="Repository root.")
    intent.add_argument("--state-dir", default=DEFAULT_STATE_DIR, help="State directory.")
    intent.add_argument("--output", help="Intent file to write. Defaults to latest session intent.json.")
    intent.add_argument("--invariant", required=True, help="Invariant or behavior boundary for the turn.")
    intent.add_argument("--package-owner", required=True, help="Expected package, module, or file owner.")
    intent.add_argument("--boundary-input", action="append", default=[], help="Untrusted input boundary. May repeat.")
    intent.add_argument("--domain-type", action="append", default=[], help="Trusted domain type or value. May repeat.")
    intent.add_argument("--expected-failure", action="append", default=[], help="Typed expected failure. May repeat.")
    intent.add_argument("--proof-target", action="append", default=[], help="Kast, Gradle, test, or CI proof target. May repeat.")
    intent.add_argument("--note", default="", help="Optional short note.")
    intent.set_defaults(func=write_intent)

    record = subparsers.add_parser("record-command", help="Append command evidence as JSONL.")
    record.add_argument("--repo", default=".", help="Repository root.")
    record.add_argument("--evidence-file", required=True, help="JSONL evidence file.")
    record.add_argument("--exit-code", type=int, required=True, help="Command exit code.")
    record.add_argument("--stdout-file", help="Captured stdout file.")
    record.add_argument("--stderr-file", help="Captured stderr file.")
    record.add_argument("--note", default="", help="Short evidence note.")
    record.add_argument("command_args", nargs=argparse.REMAINDER, help="Command after --.")
    record.set_defaults(func=record_command)

    scorecard = subparsers.add_parser("scorecard", help="Write the completion scorecard.")
    scorecard.add_argument("--repo", default=".", help="Repository root.")
    scorecard.add_argument("--output", required=True, help="Scorecard JSON file.")
    scorecard.add_argument("--fail-on-fail", action="store_true", help="Exit 1 when any dimension is Fail.")
    for dimension in SCORE_DIMENSIONS:
        scorecard.add_argument(f"--{dimension.replace('_', '-')}", choices=SCORE_VALUES, required=True)
    scorecard.set_defaults(func=write_scorecard)

    args = parser.parse_args(argv)
    return args.func(args)


def init_session(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo).resolve()
    state_root = resolve_path(repo_root, args.state_dir)
    timestamp = utc_now().strftime("%Y%m%dT%H%M%SZ")
    slug = safe_slug(args.session_name)
    session_dir = state_root / f"{timestamp}-{slug}"
    kast_dir = session_dir / "kast"
    logs_dir = session_dir / "logs"
    for directory in (kast_dir, logs_dir):
        directory.mkdir(parents=True, exist_ok=False)

    payload = {
        "version": STATE_VERSION,
        "repoRoot": str(repo_root),
        "createdAt": utc_now_iso(),
        "sessionDir": str(session_dir),
        "kastDir": str(kast_dir),
        "logsDir": str(logs_dir),
        "evidenceFile": str(session_dir / "evidence.jsonl"),
        "scorecardFile": str(session_dir / "scorecard.json"),
    }
    atomic_write_json(session_dir / "session.json", payload)
    atomic_write_json(state_root / "latest.json", payload)
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


def write_diagnostics_request(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo).resolve()
    if not args.file:
        raise SystemExit("at least one --file is required")
    file_paths = [resolve_kotlin_file(repo_root, value) for value in args.file]
    payload = {
        "jsonrpc": "2.0",
        "id": args.id,
        "method": "raw/diagnostics",
        "params": {
            "filePaths": [str(path) for path in file_paths],
        },
    }
    output = resolve_path(repo_root, args.output)
    atomic_write_json(output, payload, compact=True)
    print(json.dumps({"requestFile": str(output), "fileCount": len(file_paths)}, indent=2, sort_keys=True))
    return 0


def write_intent(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo).resolve()
    output = resolve_path(repo_root, args.output) if args.output else latest_session_file(repo_root, args.state_dir, "intent.json")
    payload = {
        "version": STATE_VERSION,
        "repoRoot": str(repo_root),
        "recordedAt": utc_now_iso(),
        "invariant": args.invariant,
        "boundaryInputs": args.boundary_input,
        "domainTypes": args.domain_type,
        "expectedFailures": args.expected_failure,
        "packageOwner": args.package_owner,
        "proofTargets": args.proof_target,
        "note": args.note,
    }
    atomic_write_json(output, payload)
    print(json.dumps({"intentFile": str(output)}, indent=2, sort_keys=True))
    return 0


def record_command(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo).resolve()
    command_args = list(args.command_args)
    if command_args and command_args[0] == "--":
        command_args = command_args[1:]
    if not command_args:
        raise SystemExit("record-command requires command arguments after --")

    evidence_file = resolve_path(repo_root, args.evidence_file)
    evidence_file.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "version": STATE_VERSION,
        "recordedAt": utc_now_iso(),
        "repoRoot": str(repo_root),
        "command": command_args,
        "exitCode": args.exit_code,
        "stdoutFile": optional_resolved(repo_root, args.stdout_file),
        "stderrFile": optional_resolved(repo_root, args.stderr_file),
        "note": args.note,
    }
    with evidence_file.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")
    print(json.dumps({"evidenceFile": str(evidence_file)}, indent=2, sort_keys=True))
    return 0


def write_scorecard(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo).resolve()
    scores = {
        dimension: getattr(args, dimension)
        for dimension in SCORE_DIMENSIONS
    }
    payload = {
        "version": STATE_VERSION,
        "repoRoot": str(repo_root),
        "scoredAt": utc_now_iso(),
        "scores": scores,
        "hasFail": any(value == "Fail" for value in scores.values()),
        "concerns": [name for name, value in scores.items() if value == "Concern"],
        "failures": [name for name, value in scores.items() if value == "Fail"],
    }
    output = resolve_path(repo_root, args.output)
    atomic_write_json(output, payload)
    print(json.dumps({"scorecardFile": str(output), "hasFail": payload["hasFail"]}, indent=2, sort_keys=True))
    return 1 if args.fail_on_fail and payload["hasFail"] else 0


def resolve_kotlin_file(repo_root: Path, value: str) -> Path:
    path = resolve_path(repo_root, value)
    if path.suffix not in {".kt", ".kts"}:
        raise SystemExit(f"not a Kotlin file: {value}")
    if not path.is_file():
        raise SystemExit(f"Kotlin file does not exist: {value}")
    return path


def optional_resolved(repo_root: Path, value: str | None) -> str | None:
    if not value:
        return None
    return str(resolve_path(repo_root, value))


def latest_session_file(repo_root: Path, state_dir: str, filename: str) -> Path:
    latest_file = resolve_path(repo_root, state_dir) / "latest.json"
    if not latest_file.exists():
        raise SystemExit(f"latest session does not exist: {latest_file}; run init first or pass --output")
    try:
        latest = json.loads(latest_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise SystemExit(f"latest session is invalid JSON: {latest_file}: {error}") from error
    session_dir = latest.get("sessionDir")
    if not isinstance(session_dir, str) or not session_dir:
        raise SystemExit(f"latest session is missing sessionDir: {latest_file}")
    return Path(session_dir) / filename


def resolve_path(repo_root: Path, value: str) -> Path:
    path = Path(value).expanduser()
    if path.is_absolute():
        return path.resolve()
    return (repo_root / path).resolve()


def safe_slug(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9_.-]+", "-", value.strip().lower()).strip("._-")
    return slug or "session"


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def atomic_write_json(path: Path, payload: dict[str, Any], *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    if compact:
        text = json.dumps(payload, separators=(",", ":"), sort_keys=True) + "\n"
    else:
        text = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    temporary.write_text(text, encoding="utf-8")
    temporary.replace(path)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
