#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


STRICT_RE = re.compile(r"^\s*set\s+-([A-Za-z]+)\s+pipefail\s*$")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run lightweight shell safety checks.")
    parser.add_argument("paths", nargs="+", help="Shell scripts to check.")
    parser.add_argument("--allow-missing-strict", action="store_true", help="Do not fail when strict mode is absent.")
    args = parser.parse_args(argv)

    results = [check_path(Path(path), allow_missing_strict=args.allow_missing_strict) for path in args.paths]
    findings = [finding for result in results for finding in result["findings"]]
    output = {
        "ok": not findings,
        "checked": len(results),
        "results": results,
        "findings": findings,
    }
    print(json.dumps(output, indent=2, sort_keys=True))
    return 0 if not findings else 1


def check_path(path: Path, *, allow_missing_strict: bool) -> dict[str, Any]:
    findings: list[str] = []
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {"path": str(path), "findings": [f"{path}: file does not exist"]}

    lines = text.splitlines()
    first_line = lines[0] if lines else ""
    if not first_line.startswith("#!"):
        findings.append(f"{path}: missing shebang")
    elif "bash" not in first_line:
        findings.append(f"{path}: expected a bash shebang for Bash safety checks")

    strict_line = next((line for line in lines if line.strip().startswith("set -")), "")
    if strict_line:
        match = STRICT_RE.match(strict_line)
        flags = match.group(1) if match else ""
        if not match or "e" not in flags or "u" not in flags:
            findings.append(f"{path}: strict mode should include -e, -u, and pipefail")
    elif not allow_missing_strict:
        findings.append(f"{path}: missing strict mode line such as set -Eeuo pipefail")

    if "mktemp" in text and not any("trap " in line and "EXIT" in line for line in lines):
        findings.append(f"{path}: mktemp usage should be paired with an EXIT trap")
    if re.search(r"\beval\s+", text):
        findings.append(f"{path}: avoid eval in CI or hook scripts")
    if re.search(r"curl\b.*\|\s*(bash|sh)\b", text):
        findings.append(f"{path}: avoid piping curl directly to a shell")
    for line_number, line in enumerate(lines, start=1):
        if "rm -rf" in line and "--" not in line and "${" in line:
            findings.append(f"{path}:{line_number}: rm -rf with variables should use -- before paths")

    return {"path": str(path), "findings": findings}


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
