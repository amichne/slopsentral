#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


PASS_REQUIRED_FOR_PROMOTE = ("capabilityBoundary", "schemaCoverage", "provenance", "validation")
EVIDENCE_BLOCKS = ("capabilityBoundary", "schemaCoverage", "provenance", "runtimeSafety")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate primitive audit manifest records.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    check = subparsers.add_parser("check", help="Check audit records against local source paths.")
    check.add_argument("--repo", default=".", help="Repository root.")
    check.add_argument("--audit-id", help="Audit entry id to check. Defaults to every entry.")
    check.add_argument(
        "--allow-missing-source-graph-command",
        action="store_true",
        help="Do not require node source/tools/validate-source-graph.mjs in validation commands.",
    )
    check.set_defaults(func=check_records)

    args = parser.parse_args(argv)
    return args.func(args)


def check_records(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    manifest_path = repo / "garden" / "manifests" / "primitive-audits.json"
    findings: list[str] = []
    manifest = read_json(manifest_path, findings)
    checked = 0

    if manifest is not None:
        entries = manifest.get("entries", [])
        if not isinstance(entries, list):
            findings.append("entries must be an array")
            entries = []
        for index, entry in enumerate(entries):
            if args.audit_id and entry.get("id") != args.audit_id:
                continue
            checked += 1
            check_entry(
                repo,
                f"entries[{index}]",
                entry,
                findings,
                require_source_graph_command=not args.allow_missing_source_graph_command,
            )
        if args.audit_id and checked == 0:
            findings.append(f"audit entry not found: {args.audit_id}")

    output = {
        "ok": not findings,
        "auditId": args.audit_id,
        "checkedEntries": checked,
        "findings": findings,
    }
    print(json.dumps(output, indent=2, sort_keys=True))
    return 0 if not findings else 1


def check_entry(
    repo: Path,
    owner: str,
    entry: Any,
    findings: list[str],
    *,
    require_source_graph_command: bool,
) -> None:
    if not isinstance(entry, dict):
        findings.append(f"{owner}: entry must be an object")
        return
    if contains_private_path(entry):
        findings.append(f"{owner}: audit entries must not contain private absolute paths")
    target = entry.get("target")
    if not isinstance(target, dict):
        findings.append(f"{owner}: target is required")
        return
    target_paths = target.get("paths", [])
    if not isinstance(target_paths, list) or not target_paths:
        findings.append(f"{owner}: target.paths must be a non-empty array")
    else:
        for value in target_paths:
            if not isinstance(value, str) or not value:
                findings.append(f"{owner}: target.paths entries must be non-empty strings")
                continue
            if value.startswith("/") or ".." in Path(value).parts:
                findings.append(f"{owner}: target path must be repo-relative: {value}")
                continue
            if not (repo / value).exists():
                findings.append(f"{owner}: target path does not exist: {value}")

    if target.get("kind") == "PLUGIN":
        expected_manifest = f"source/plugins/{target.get('name')}/plugin.json"
        if expected_manifest not in target_paths:
            findings.append(f"{owner}: plugin audits must include {expected_manifest}")

    if entry.get("decision") == "PROMOTE_READY":
        for field in PASS_REQUIRED_FOR_PROMOTE:
            if entry.get(field, {}).get("status") != "PASS":
                findings.append(f"{owner}: PROMOTE_READY requires {field}.status PASS")

    for field in EVIDENCE_BLOCKS:
        block = entry.get(field)
        if not isinstance(block, dict):
            findings.append(f"{owner}: {field} must be an object")
            continue
        if block.get("status") not in {"PASS", "PARTIAL", "BLOCKED"}:
            findings.append(f"{owner}: {field}.status is invalid")
        evidence = block.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            findings.append(f"{owner}: {field}.evidence must be non-empty")

    validation = entry.get("validation")
    if not isinstance(validation, dict):
        findings.append(f"{owner}: validation must be an object")
    else:
        commands = validation.get("commands")
        if not isinstance(commands, list) or not commands:
            findings.append(f"{owner}: validation.commands must be non-empty")
        elif require_source_graph_command and "node source/tools/validate-source-graph.mjs" not in commands:
            findings.append(f"{owner}: validation.commands must include node source/tools/validate-source-graph.mjs")

    risks = entry.get("residualRisks")
    if not isinstance(risks, list) or not risks:
        findings.append(f"{owner}: residualRisks must be non-empty")


def contains_private_path(value: Any) -> bool:
    if isinstance(value, str):
        return "/Users/" in value
    if isinstance(value, list):
        return any(contains_private_path(item) for item in value)
    if isinstance(value, dict):
        return any(contains_private_path(item) for item in value.values())
    return False


def read_json(path: Path, findings: list[str]) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        findings.append(f"missing JSON file: {path}")
        return None
    except json.JSONDecodeError as error:
        findings.append(f"invalid JSON: {path}: {error}")
        return None
    if not isinstance(payload, dict):
        findings.append(f"JSON root must be an object: {path}")
        return None
    return payload


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
