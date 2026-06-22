#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


VERSION = 1
PHASES = ("red", "green")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Record negative capability proof evidence.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init = subparsers.add_parser("init", help="Create a proof record.")
    init.add_argument("--repo", default=".", help="Repository root.")
    init.add_argument("--output", required=True, help="Proof JSON file to write.")
    init.add_argument("--scope", required=True, help="Module, package, feature, service, or file scope.")
    init.add_argument("--invariant", required=True, help="Architectural invariant being proven.")
    init.add_argument("--current-enforcement", required=True, help="Current runtime, convention, or test enforcement.")
    init.add_argument("--misuse", required=True, help="Invalid state or operation currently representable.")
    init.add_argument("--target-shape", required=True, help="Expected type-level representation after refactor.")
    init.add_argument("--blast-radius", default="", help="Estimated affected API or call-site surface.")
    init.set_defaults(func=init_record)

    record = subparsers.add_parser("record-phase", help="Append red or green proof evidence.")
    record.add_argument("--repo", default=".", help="Repository root.")
    record.add_argument("--proof-file", required=True, help="Proof JSON file to update.")
    record.add_argument("--phase", choices=PHASES, required=True, help="Proof phase.")
    record.add_argument("--claim", required=True, help="What this evidence proves.")
    record.add_argument("--command", required=True, help="Command that produced the evidence.")
    record.add_argument("--exit-code", type=int, required=True, help="Command exit code.")
    record.add_argument("--evidence-file", action="append", default=[], help="Evidence file path. May repeat.")
    record.add_argument("--note", default="", help="Optional short note.")
    record.set_defaults(func=record_phase)

    check = subparsers.add_parser("check", help="Validate proof record completeness.")
    check.add_argument("--repo", default=".", help="Repository root.")
    check.add_argument("--proof-file", required=True, help="Proof JSON file to validate.")
    check.add_argument("--require-green-pass", action="store_true", help="Require at least one green proof with exit code 0.")
    check.set_defaults(func=check_record)

    args = parser.parse_args(argv)
    return args.func(args)


def init_record(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo).resolve()
    output = resolve_path(repo_root, args.output)
    payload = {
        "version": VERSION,
        "repoRoot": str(repo_root),
        "createdAt": now_iso(),
        "scope": args.scope,
        "invariant": args.invariant,
        "currentEnforcement": args.current_enforcement,
        "representableMisuse": args.misuse,
        "targetTypeShape": args.target_shape,
        "blastRadius": args.blast_radius,
        "phases": [],
    }
    write_json(output, payload)
    print(json.dumps({"proofFile": str(output)}, indent=2, sort_keys=True))
    return 0


def record_phase(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo).resolve()
    proof_file = resolve_path(repo_root, args.proof_file)
    payload = read_json(proof_file)
    evidence_files = [str(resolve_path(repo_root, value)) for value in args.evidence_file]
    payload.setdefault("phases", []).append(
        {
            "phase": args.phase,
            "recordedAt": now_iso(),
            "claim": args.claim,
            "command": args.command,
            "exitCode": args.exit_code,
            "evidenceFiles": evidence_files,
            "note": args.note,
        }
    )
    write_json(proof_file, payload)
    print(json.dumps({"proofFile": str(proof_file), "phase": args.phase}, indent=2, sort_keys=True))
    return 0


def check_record(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo).resolve()
    proof_file = resolve_path(repo_root, args.proof_file)
    payload = read_json(proof_file)
    findings = validate_payload(payload, proof_file, require_green_pass=args.require_green_pass)
    result = {
        "ok": not findings,
        "proofFile": str(proof_file),
        "findings": findings,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if not findings else 1


def validate_payload(payload: dict[str, Any], proof_file: Path, *, require_green_pass: bool) -> list[str]:
    findings: list[str] = []
    required_fields = [
        "version",
        "repoRoot",
        "scope",
        "invariant",
        "currentEnforcement",
        "representableMisuse",
        "targetTypeShape",
    ]
    for field in required_fields:
        if not payload.get(field):
            findings.append(f"{field} is required")
    phases = payload.get("phases")
    if not isinstance(phases, list):
        return [*findings, "phases must be an array"]
    seen = {phase.get("phase") for phase in phases if isinstance(phase, dict)}
    for phase_name in PHASES:
        if phase_name not in seen:
            findings.append(f"{phase_name} proof phase is missing")
    if require_green_pass and not any(
        isinstance(phase, dict) and phase.get("phase") == "green" and phase.get("exitCode") == 0
        for phase in phases
    ):
        findings.append("green proof phase must include a command with exitCode 0")
    for index, phase in enumerate(phases):
        if not isinstance(phase, dict):
            findings.append(f"phases[{index}] must be an object")
            continue
        if phase.get("phase") not in PHASES:
            findings.append(f"phases[{index}].phase must be red or green")
        if not phase.get("claim"):
            findings.append(f"phases[{index}].claim is required")
        if not phase.get("command"):
            findings.append(f"phases[{index}].command is required")
        if not isinstance(phase.get("exitCode"), int):
            findings.append(f"phases[{index}].exitCode must be an integer")
        for evidence_file in phase.get("evidenceFiles", []):
            evidence_path = Path(evidence_file)
            if not evidence_path.exists():
                findings.append(f"phases[{index}] evidence file is missing: {evidence_file}")
    if proof_file.exists() and proof_file.stat().st_size == 0:
        findings.append("proof file is empty")
    return findings


def read_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise SystemExit(f"proof file does not exist: {path}") from error
    except json.JSONDecodeError as error:
        raise SystemExit(f"proof file is invalid JSON: {path}: {error}") from error
    if not isinstance(payload, dict):
        raise SystemExit(f"proof file must contain a JSON object: {path}")
    return payload


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(path)


def resolve_path(repo_root: Path, value: str) -> Path:
    path = Path(value).expanduser()
    if path.is_absolute():
        return path.resolve()
    return (repo_root / path).resolve()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
