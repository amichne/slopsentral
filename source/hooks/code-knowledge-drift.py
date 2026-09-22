#!/usr/bin/env python3
"""Advisory adapter for the code-knowledge-base impact checker."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# The declared skill dependency has the same sibling layout in source and projections.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "skills/code-knowledge-base/scripts"))
from code_kb import Failure, build_impact, failure_payload, write_output


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path("."))
    parser.add_argument("--docs", default="docs")
    parser.add_argument("--changed-file", action="append", default=[])
    parser.add_argument("--format", choices=["human", "json"], default="human")
    parser.add_argument("--advisory", action="store_true")
    args = parser.parse_args(argv)
    repo = args.repo.resolve()
    result = build_impact(repo, (repo / args.docs).resolve(), args.changed_file, from_git=True)
    payload = failure_payload("impact", result) if isinstance(result, Failure) else result

    if args.format == "json":
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
