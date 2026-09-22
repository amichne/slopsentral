#!/usr/bin/env python3
"""Utility checks for OKF source-backed knowledge bundles."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from enum import Enum
from pathlib import Path, PurePosixPath
from typing import Any, NamedTuple


RESERVED_FILENAMES = {"index.md", "log.md"}
ISO_DATE_HEADING_RE = re.compile(r"^## \d{4}-\d{2}-\d{2}(?:\s|$)")
GITHUB_BLOB_PATH_RE = re.compile(r"/blob/[^/]+/(?P<path>[^#)]+)")


class Failure(Enum):
    MISSING_DOCS = ("documents", "missing-docs")
    EMPTY_DOCS = ("documents", "empty-docs")
    UNREADABLE_DOCS = ("documents", "unreadable-docs")
    INVALID_CHANGED_PATH = ("changed-paths", "invalid-changed-path")
    GIT_UNAVAILABLE = ("git-status", "git-unavailable")
    GIT_STATUS_FAILED = ("git-status", "git-status-failed")
    INVALID_GIT_STATUS = ("git-status", "invalid-git-status")


class ChangedFiles(NamedTuple):
    paths: tuple[str, ...]


def failure_payload(command: str, failure: Failure) -> dict[str, Any]:
    stage, code = failure.value
    return {"command": command, "status": "error", "error": {"stage": stage, "code": code}}


def repo_relative(path: Path, repo: Path) -> str:
    try:
        return path.resolve().relative_to(repo.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def concept_id(path: Path, docs: Path) -> str:
    return path.relative_to(docs).with_suffix("").as_posix()


def normalize_relative(value: str) -> str | None:
    if not value:
        return None
    if "://" in value:
        match = GITHUB_BLOB_PATH_RE.search(value)
        if not match:
            return None
        value = match.group("path")
    pure = PurePosixPath(value)
    if pure.is_absolute() or ".." in pure.parts or not pure.parts or "\0" in value:
        return None
    return pure.as_posix()


def markdown_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted(path for path in root.rglob("*.md") if path.is_file())


def parse_scalar(value: str) -> Any:
    value = value.strip()
    if not value:
        return ""
    if value in {"[]", "{}"}:
        return [] if value == "[]" else {}
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


def parse_frontmatter_mapping(lines: list[str]) -> tuple[dict[str, Any], list[str]]:
    mapping: dict[str, Any] = {}
    issues: list[str] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            index += 1
            continue
        if line[:1].isspace():
            issues.append(f"unexpected indented YAML line: {stripped}")
            index += 1
            continue
        if ":" not in line:
            issues.append(f"unsupported YAML line: {stripped}")
            index += 1
            continue
        key, raw_value = line.split(":", 1)
        key = key.strip()
        if raw_value.strip():
            mapping[key] = parse_scalar(raw_value)
            index += 1
            continue

        block: list[str] = []
        index += 1
        while index < len(lines) and (lines[index].startswith(" ") or not lines[index].strip()):
            block.append(lines[index])
            index += 1
        if any(item.strip().startswith("- ") for item in block):
            value, block_issues = parse_list_block(block)
            mapping[key] = value
            issues.extend(block_issues)
        else:
            mapping[key] = ""
    return mapping, issues


def split_frontmatter(text: str) -> tuple[dict[str, Any] | None, str, list[str]]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None, text, ["missing YAML frontmatter"]
    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            mapping, issues = parse_frontmatter_mapping(lines[1:index])
            body = "\n".join(lines[index + 1 :])
            return mapping, body, issues
    return None, text, ["unterminated YAML frontmatter"]


def code_sources(frontmatter: dict[str, Any] | None, repo: Path) -> tuple[list[str], list[str]]:
    if not frontmatter:
        return [], []
    raw_sources = frontmatter.get("code_sources", [])
    if raw_sources in ("", None):
        return [], []
    if not isinstance(raw_sources, list):
        return [], ["code_sources must be a list"]
    paths: list[str] = []
    issues: list[str] = []
    for source in raw_sources:
        if not isinstance(source, dict):
            issues.append("code_sources entry is not an object")
            continue
        normalized = normalize_relative(str(source.get("path", "")))
        if normalized is None:
            issues.append(f"code_sources path is invalid: {source.get('path')!r}")
            continue
        paths.append(normalized)
        if not repo.joinpath(normalized).exists():
            issues.append(f"code_sources path does not exist: {normalized}")
    return sorted(set(paths)), issues


def validate_index(path: Path, docs: Path, text: str) -> list[str]:
    if not text.startswith("---"):
        return []
    if path.relative_to(docs).as_posix() == "index.md":
        frontmatter, _, issues = split_frontmatter(text)
        if frontmatter is not None:
            unknown = sorted(key for key in frontmatter if key != "okf_version")
            issues.extend(f"root index frontmatter field is not OKF-defined: {key}" for key in unknown)
        return issues
    return ["index.md frontmatter is only allowed at the bundle root for okf_version"]


def validate_log(text: str) -> list[str]:
    issues: list[str] = []
    if text.startswith("---"):
        issues.append("log.md must not contain frontmatter")
    for line in text.splitlines():
        if line.startswith("## ") and not ISO_DATE_HEADING_RE.match(line):
            issues.append(f"log heading must use YYYY-MM-DD: {line}")
    return issues


def parse_page(path: Path, repo: Path, docs: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    relative = repo_relative(path, repo)
    docs_relative = path.relative_to(docs).as_posix()
    issues: list[str] = []
    frontmatter: dict[str, Any] | None = None
    source_paths: list[str] = []
    kind = "concept"

    if path.name == "index.md":
        kind = "index"
        issues.extend(validate_index(path, docs, text))
    elif path.name == "log.md":
        kind = "log"
        issues.extend(validate_log(text))
    else:
        frontmatter, _, frontmatter_issues = split_frontmatter(text)
        issues.extend(frontmatter_issues)
        if frontmatter is not None:
            type_value = frontmatter.get("type")
            if not isinstance(type_value, str) or not type_value.strip():
                issues.append("frontmatter type is required")
            paths, source_issues = code_sources(frontmatter, repo)
            source_paths.extend(paths)
            issues.extend(source_issues)

    return {
        "path": relative,
        "docsPath": docs_relative,
        "conceptId": concept_id(path, docs) if kind == "concept" else None,
        "kind": kind,
        "frontmatter": frontmatter,
        "sourcePaths": sorted(set(source_paths)),
        "issues": issues,
    }


def collect_pages(repo: Path, docs: Path) -> list[dict[str, Any]] | Failure:
    try:
        if not docs.is_dir():
            return Failure.MISSING_DOCS
        files = markdown_files(docs)
        if not files:
            return Failure.EMPTY_DOCS
        return [parse_page(path, repo, docs) for path in files]
    except (OSError, UnicodeError):
        return Failure.UNREADABLE_DOCS


def changed_files_from_git(repo: Path) -> ChangedFiles | Failure:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo), "status", "--porcelain=v1", "-z", "--untracked-files=all"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    except OSError:
        return Failure.GIT_UNAVAILABLE
    if result.returncode != 0:
        return Failure.GIT_STATUS_FAILED
    try:
        output = result.stdout.decode("utf-8")
    except UnicodeError:
        return Failure.INVALID_GIT_STATUS
    if output and not output.endswith("\0"):
        return Failure.INVALID_GIT_STATUS
    values = output.split("\0")[:-1]
    changed: set[str] = set()
    index = 0
    while index < len(values):
        entry = values[index]
        index += 1
        if len(entry) < 4 or entry[2] != " " or any(char not in " MADRCU?!T" for char in entry[:2]):
            return Failure.INVALID_GIT_STATUS
        status = entry[:2]
        path = normalize_relative(entry[3:])
        if path is None:
            return Failure.INVALID_GIT_STATUS
        changed.add(path)
        if "R" in status or "C" in status:
            if index >= len(values):
                return Failure.INVALID_GIT_STATUS
            original = normalize_relative(values[index])
            index += 1
            if original is None:
                return Failure.INVALID_GIT_STATUS
            changed.add(original)
    return ChangedFiles(tuple(sorted(changed)))


def resolve_changes(repo: Path, paths: list[str], from_git: bool) -> ChangedFiles | Failure:
    changed: set[str] = set()
    for path in paths:
        normalized = normalize_relative(path)
        if normalized is None:
            return Failure.INVALID_CHANGED_PATH
        changed.add(normalized)
    if from_git:
        result = changed_files_from_git(repo)
        if isinstance(result, Failure):
            return result
        changed.update(result.paths)
    return ChangedFiles(tuple(sorted(changed)))


def impacted_pages(pages: list[dict[str, Any]], changed: list[str]) -> list[dict[str, Any]]:
    changed_set = set(changed)
    impacted: list[dict[str, Any]] = []
    for page in pages:
        matching = sorted(changed_set.intersection(page["sourcePaths"]))
        if matching or page["path"] in changed_set:
            impacted.append(
                {
                    "path": page["path"],
                    "conceptId": page["conceptId"],
                    "matchedSources": matching,
                    "pageChanged": page["path"] in changed_set,
                }
            )
    return impacted


def write_output(payload: dict[str, Any], output_format: str) -> None:
    if output_format == "json":
        print(json.dumps(payload, indent=2, sort_keys=True))
        return
    if payload["status"] == "error":
        print(f"okf {payload['command']}: unavailable ({payload['error']['code']})")
        return
    command = payload.get("command")
    if command == "check":
        print(
            f"okf check: {payload['concepts']} concept(s), "
            f"{payload['reservedFiles']} reserved file(s), {payload['issueCount']} issue(s)"
        )
        for issue in payload["issues"]:
            print(f"- {issue['path']}: {issue['message']}")
    elif command == "impact":
        print(
            f"okf impact: {len(payload['changedFiles'])} changed file(s), "
            f"{len(payload['impactedPages'])} impacted concept(s)"
        )
        for page in payload["impactedPages"]:
            sources = ", ".join(page["matchedSources"]) or "concept changed"
            print(f"- {page['path']}: {sources}")
        for issue in payload["issues"]:
            print(f"- {issue['path']}: {issue['message']}")


def command_check(args: argparse.Namespace) -> int:
    repo = args.repo.resolve()
    docs = (repo / args.docs).resolve()
    pages = collect_pages(repo, docs)
    if isinstance(pages, Failure):
        write_output(failure_payload("check", pages), args.format)
        return 1
    issues = [
        {"path": page["path"], "message": issue}
        for page in pages
        for issue in page["issues"]
    ]
    payload = {
        "command": "check",
        "status": "invalid" if issues else "ok",
        "repo": str(repo),
        "docs": repo_relative(docs, repo),
        "pages": len(pages),
        "concepts": sum(1 for page in pages if page["kind"] == "concept"),
        "reservedFiles": sum(1 for page in pages if page["kind"] != "concept"),
        "issueCount": len(issues),
        "issues": issues,
    }
    write_output(payload, args.format)
    return 1 if args.strict and issues else 0


def build_impact(repo: Path, docs: Path, paths: list[str], from_git: bool) -> dict[str, Any] | Failure:
    pages = collect_pages(repo, docs)
    if isinstance(pages, Failure):
        return pages
    changed = resolve_changes(repo, paths, from_git)
    if isinstance(changed, Failure):
        return changed
    issues = [{"path": page["path"], "message": issue} for page in pages for issue in page["issues"]]
    return {
        "command": "impact",
        "status": "invalid" if issues else "ok",
        "repo": str(repo),
        "docs": repo_relative(docs, repo),
        "changedFiles": list(changed.paths),
        "impactedPages": impacted_pages(pages, list(changed.paths)),
        "issues": issues,
    }


def command_impact(args: argparse.Namespace) -> int:
    repo = args.repo.resolve()
    result = build_impact(repo, (repo / args.docs).resolve(), args.changed_file, args.from_git)
    payload = failure_payload("impact", result) if isinstance(result, Failure) else result
    write_output(payload, args.format)
    return 0 if payload["status"] == "ok" else 1


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    subcommands = root.add_subparsers(dest="command", required=True)

    check = subcommands.add_parser("check", help="Validate an OKF bundle.")
    check.add_argument("--repo", type=Path, default=Path("."))
    check.add_argument("--docs", default="docs")
    check.add_argument("--format", choices=["human", "json"], default="human")
    check.add_argument("--strict", action="store_true")
    check.set_defaults(func=command_check)

    impact = subcommands.add_parser("impact", help="Find OKF concepts affected by changed files.")
    impact.add_argument("--repo", type=Path, default=Path("."))
    impact.add_argument("--docs", default="docs")
    impact.add_argument("--changed-file", action="append", default=[])
    impact.add_argument("--from-git", action="store_true")
    impact.add_argument("--format", choices=["human", "json"], default="human")
    impact.set_defaults(func=command_impact)
    return root


def main(argv: list[str]) -> int:
    args = parser().parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
