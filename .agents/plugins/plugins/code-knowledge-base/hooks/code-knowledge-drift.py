#!/usr/bin/env python3
"""Advisory hook for OKF concept drift."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath
from typing import Any


RESERVED_FILENAMES = {"index.md", "log.md"}
GITHUB_BLOB_PATH_RE = re.compile(r"/blob/[^/]+/(?P<path>[^#)]+)")


def normalize_relative(value: str) -> str | None:
    if not value:
        return None
    if "://" in value:
        match = GITHUB_BLOB_PATH_RE.search(value)
        if not match:
            return None
        value = match.group("path")
    pure = PurePosixPath(value)
    if pure.is_absolute() or ".." in pure.parts:
        return None
    return pure.as_posix()


def repo_relative(path: Path, repo: Path) -> str:
    try:
        return path.resolve().relative_to(repo.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def markdown_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted(path for path in root.rglob("*.md") if path.is_file())


def parse_scalar(value: str) -> Any:
    value = value.strip()
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        return [part.strip().strip("'\"") for part in inner.split(",")]
    if value.startswith(("'", '"')) and value.endswith(("'", '"')):
        return value[1:-1]
    return value


def parse_list_block(lines: list[str]) -> tuple[list[Any], list[str]]:
    items: list[Any] = []
    issues: list[str] = []
    current: dict[str, Any] | None = None
    for raw in lines:
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("- "):
            value = stripped[2:].strip()
            if ":" in value:
                key, raw_value = value.split(":", 1)
                current = {key.strip(): parse_scalar(raw_value)}
                items.append(current)
            else:
                current = None
                items.append(parse_scalar(value))
            continue
        if current is not None and ":" in stripped:
            key, raw_value = stripped.split(":", 1)
            current[key.strip()] = parse_scalar(raw_value)
            continue
        issues.append(f"unsupported YAML list line: {stripped}")
    return items, issues


def parse_frontmatter(text: str) -> tuple[dict[str, Any] | None, list[str]]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None, ["missing YAML frontmatter"]
    closing = next((index for index in range(1, len(lines)) if lines[index].strip() == "---"), None)
    if closing is None:
        return None, ["unterminated YAML frontmatter"]
    payload: dict[str, Any] = {}
    issues: list[str] = []
    frontmatter = lines[1:closing]
    index = 0
    while index < len(frontmatter):
        line = frontmatter[index]
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            index += 1
            continue
        if line[:1].isspace() or ":" not in line:
            issues.append(f"unsupported YAML line: {stripped}")
            index += 1
            continue
        key, raw_value = line.split(":", 1)
        key = key.strip()
        if raw_value.strip():
            payload[key] = parse_scalar(raw_value)
            index += 1
            continue
        block: list[str] = []
        index += 1
        while index < len(frontmatter) and (frontmatter[index].startswith(" ") or not frontmatter[index].strip()):
            block.append(frontmatter[index])
            index += 1
        if any(item.strip().startswith("- ") for item in block):
            value, block_issues = parse_list_block(block)
            payload[key] = value
            issues.extend(block_issues)
        else:
            payload[key] = ""
    return payload, issues


def concept_sources(path: Path) -> tuple[list[str], list[str]]:
    if path.name in RESERVED_FILENAMES:
        return [], []
    frontmatter, issues = parse_frontmatter(path.read_text(encoding="utf-8"))
    if frontmatter is None:
        return [], issues
    sources = frontmatter.get("code_sources", [])
    if sources in ("", None):
        return [], issues
    if not isinstance(sources, list):
        return [], issues + ["code_sources must be a list"]
    paths: set[str] = set()
    for source in sources:
        if not isinstance(source, dict):
            issues.append("code_sources entry is not an object")
            continue
        normalized = normalize_relative(str(source.get("path", "")))
        if normalized:
            paths.add(normalized)
        else:
            issues.append(f"code_sources path is invalid: {source.get('path')!r}")
    return sorted(paths), issues


def changed_files_from_git(repo: Path) -> list[str]:
    result = subprocess.run(
        ["git", "-C", str(repo), "status", "--porcelain=v1", "-z", "--untracked-files=all"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        return []
    values = result.stdout.decode("utf-8", errors="replace").split("\0")
    changed: set[str] = set()
    index = 0
    while index < len(values):
        entry = values[index]
        index += 1
        if not entry or len(entry) < 4:
            continue
        status = entry[:2]
        path = normalize_relative(entry[3:])
        if path:
            changed.add(path)
        if ("R" in status or "C" in status) and index < len(values):
            original = normalize_relative(values[index])
            index += 1
            if original:
                changed.add(original)
    return sorted(changed)


def check(repo: Path, docs: Path, changed_files: list[str]) -> dict[str, Any]:
    concepts = []
    issues = []
    changed = set(changed_files)
    for path in markdown_files(docs):
        sources, page_issues = concept_sources(path)
        relative = repo_relative(path, repo)
        for issue in page_issues:
            issues.append({"path": relative, "message": issue})
        matching = sorted(changed.intersection(sources))
        if matching or relative in changed:
            concepts.append(
                {
                    "path": relative,
                    "matchedSources": matching,
                    "conceptChanged": relative in changed,
                }
            )
    return {
        "repo": str(repo),
        "docs": repo_relative(docs, repo),
        "changedFiles": sorted(changed),
        "impactedConcepts": concepts,
        "issues": issues,
    }


def print_human(payload: dict[str, Any]) -> None:
    if not payload["changedFiles"]:
        print("OKF knowledge drift: no changed files found.")
        return
    if not payload["impactedConcepts"] and not payload["issues"]:
        print("OKF knowledge drift: no source-backed concepts impacted.")
        return
    if payload["impactedConcepts"]:
        print(f"OKF knowledge drift: {len(payload['impactedConcepts'])} concept(s) may need refresh.")
        for concept in payload["impactedConcepts"]:
            sources = ", ".join(concept["matchedSources"]) or "concept changed"
            print(f"- {concept['path']}: {sources}")
    for issue in payload["issues"]:
        print(f"- {issue['path']}: {issue['message']}")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    root.add_argument("--repo", type=Path, default=Path("."))
    root.add_argument("--docs", default="docs")
    root.add_argument("--changed-file", action="append", default=[])
    root.add_argument("--format", choices=["human", "json"], default="human")
    root.add_argument("--advisory", action="store_true")
    return root


def main(argv: list[str]) -> int:
    args = parser().parse_args(argv)
    repo = args.repo.resolve()
    docs = (repo / args.docs).resolve()
    changed = sorted(set(args.changed_file + changed_files_from_git(repo)))
    payload = check(repo, docs, changed)
    if args.format == "json":
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print_human(payload)
    should_block = (payload["impactedConcepts"] or payload["issues"]) and not args.advisory
    return 1 if should_block else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
