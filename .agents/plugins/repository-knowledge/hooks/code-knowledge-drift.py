#!/usr/bin/env python3
"""Advisory adapter for the code-knowledge-base impact checker."""

from __future__ import annotations

import argparse
from enum import Enum
import json
import sys

from pathlib import Path

sys.dont_write_bytecode = True

# The declared skill dependency has the same sibling layout in source and projections.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "skills/code-knowledge-base/scripts"))
from code_kb import Failure, build_impact, failure_payload, write_output
from knowledge_overlay import Failure as OverlayFailure, Knowledge, NoOverlay, select_knowledge


class OutputFormat(str, Enum):
    HUMAN = "human"
    JSON = "json"
    CODEX_STOP = "codex-stop"


class ImpactOutcome(str, Enum):
    OK = "ok"
    INVALID = "invalid"


def emit_stop(result: dict | Failure | OverlayFailure) -> None:
    """Keep native hook feedback bounded; the ordinary CLI owns full reports."""
    if isinstance(result, (Failure, OverlayFailure)):
        stage, code = result.value if isinstance(result, Failure) else (result.stage.value, result.code.value)
        evidence = {"type": "KNOWLEDGE_DRIFT_STOP", "stage": stage, "outcome": "error", "code": code}
        message = f"knowledge-drift: stage={stage} outcome=error code={code}; drift is unverified. Inspect the knowledge checker when relevant."
    else:
        outcome = ImpactOutcome(result["status"])
        evidence = {
            "type": "KNOWLEDGE_DRIFT_STOP", "stage": "impact", "outcome": outcome.value,
            "changedFiles": len(result["changedFiles"]),
            "impactedConcepts": len(result["impactedPages"]),
            "metadataIssues": len(result["issues"]),
        }
        message = (
            f"knowledge-drift: stage=impact outcome={outcome.value} "
            f"changed-files={evidence['changedFiles']} impacted-concepts={evidence['impactedConcepts']} "
            f"metadata-issues={evidence['metadataIssues']}; advisory only."
        )
        if outcome is ImpactOutcome.INVALID:
            message += " Metadata is invalid; drift is unverified."
    print(json.dumps({"systemMessage": message}))
    print(json.dumps(evidence), file=sys.stderr)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path("."))
    parser.add_argument("--docs", default="docs")
    parser.add_argument("--changed-file", action="append", default=[])
    parser.add_argument("--format", choices=[value.value for value in OutputFormat], default=OutputFormat.HUMAN.value)
    parser.add_argument("--advisory", action="store_true")
    args = parser.parse_args(argv)
    repo = args.repo.resolve()
    selected = select_knowledge(repo)
    if selected is NoOverlay.UNREGISTERED:
        if args.format == OutputFormat.CODEX_STOP.value:
            print("{}")
            print(json.dumps({"type": "KNOWLEDGE_DRIFT_STOP", "stage": "selection", "outcome": "UNREGISTERED"}), file=sys.stderr)
        else:
            if args.format == OutputFormat.JSON.value:
                print(json.dumps({"type": "KNOWLEDGE_DRIFT_SKIPPED", "reason": "UNREGISTERED"}))
            else:
                print("knowledge-drift: repository is unregistered; no overlay scan requested")
        return 0
    if isinstance(selected, OverlayFailure):
        result = selected
        payload = {"command": "impact", "status": "error", "error": {"stage": selected.stage.value, "code": selected.code.value}}
    else:
        if isinstance(selected, Knowledge):
            repo, docs = selected.source, selected.documents
        else:
            docs = (repo / args.docs).resolve()
        result = build_impact(repo, docs, args.changed_file, from_git=True)
        payload = failure_payload("impact", result) if isinstance(result, Failure) else result

    output_format = OutputFormat(args.format)
    if output_format is OutputFormat.CODEX_STOP:
        emit_stop(result)
    elif output_format is OutputFormat.JSON:
        # Preserve the hook's public field names while sharing parsing and validation.
        hook_payload = dict(payload)
        if "impactedPages" in hook_payload:
            hook_payload["impactedConcepts"] = [
                {"path": page["path"], "matchedSources": page["matchedSources"],
                 "conceptChanged": page["pageChanged"]}
                for page in hook_payload.pop("impactedPages")
            ]
        print(json.dumps(hook_payload, indent=2, sort_keys=True))
    else:
        write_output(payload, "human")

    if args.advisory:
        return 0
    if payload["status"] != "ok":
        return 1
    return 1 if payload["impactedPages"] else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
