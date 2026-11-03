#!/usr/bin/env -S uv run --locked --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = []
# [tool.uv]
# no-build = true
# required-version = ">=0.12.9"
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""Assess changed prose with the policy shipped beside this command."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import TYPE_CHECKING, TypeGuard

if TYPE_CHECKING:
    from collections.abc import Iterator

POLICY = Path(__file__).resolve().parents[1]
SKILL = POLICY / "source/skills/controlled-technical-writing"
FORMATS = {".md", ".mdx", ".txt"}


class Reason(StrEnum):
    UNSAFE_PATH = "UNSAFE_PATH"
    INVALID_REPORT = "INVALID_REPORT"
    ENGINE = "ENGINE"
    ASSESSMENT = "ASSESSMENT"
    INPUT = "INPUT"
    SETUP = "SETUP"


@dataclass(frozen=True)
class Rejected:
    code: Reason
    detail: str


def mapping(value: object) -> TypeGuard[Mapping[object, object]]:
    return isinstance(value, Mapping)


def sequence(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def git(repo: Path, *args: str) -> bytes:
    return subprocess.check_output(
        ["git", "--literal-pathspecs", "-C", str(repo), *args], stderr=subprocess.PIPE
    )


def commit(repo: Path, ref: str) -> str:
    return (
        git(repo, "rev-parse", "--verify", "--end-of-options", ref + "^{commit}").decode().strip()
    )


@dataclass(frozen=True)
class Change:
    path: str
    previous: str | None
    deleted: bool = False


def changed(repo: Path, base: str, head: str | None) -> Iterator[Change]:
    revisions = (base, head) if head else (base,)
    fields = iter(
        git(
            repo,
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--find-renames",
            "--name-status",
            "-z",
            *revisions,
            "--",
        )
        .decode()
        .split("\0")
    )
    for status in fields:
        if not status:
            break
        old = next(fields)
        if status.startswith("R"):
            yield Change(next(fields), old)
        else:
            yield Change(old, None if status == "A" else old, status == "D")
    if head is None:
        for name in (
            git(repo, "ls-files", "--others", "--exclude-standard", "-z").decode().split("\0")
        ):
            if name:
                yield Change(name, None)


def exclusion(name: str) -> str | None:
    if name.startswith((".agents/plugins/", ".github/plugin/", "tools/tests/fixtures/")):
        return "provider output or test fixture"
    if name in {"source/CATALOG.md", "docs/GLOSSARY.md"}:
        return "generated reference"
    if name.startswith("source/skills/controlled-technical-writing/assets/vale/"):
        return "vendored style resources"
    return None


def contents(repo: Path, ref: str | None, name: str) -> bytes | Rejected:
    if ref:
        record = git(repo, "ls-tree", "-z", ref, "--", name)
        meta, sep, filename = record.removesuffix(b"\0").partition(b"\t")
        if (
            not sep
            or filename.decode() != name
            or meta.split()[:1] not in ([b"100644"], [b"100755"])
        ):
            return Rejected(Reason.UNSAFE_PATH, "Expected a regular Git blob")
        return git(repo, "cat-file", "blob", meta.split()[2].decode())
    path = repo / name
    if path.resolve() != path or not path.is_file():
        return Rejected(Reason.UNSAFE_PATH, "Expected a regular worktree file")
    return path.read_bytes()


def run_script(
    script: str, args: list[str], cwd: Path
) -> tuple[int, Mapping[object, object]] | Rejected:
    proc = subprocess.run(
        [
            "uv",
            "run",
            "--no-config",
            "--locked",
            "--script",
            str(SKILL / "scripts" / script),
            *args,
        ],
        cwd=cwd,
        capture_output=True,
        check=False,
    )
    if not proc.stdout:
        return Rejected(
            Reason.INVALID_REPORT, f"{script} exited {proc.returncode} without a report"
        )
    report: object = json.loads(proc.stdout)
    if not mapping(report):
        return Rejected(Reason.INVALID_REPORT, script)
    return proc.returncode, report


def engine(root: Path) -> str | Rejected:
    cache = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "slopsentral/vale"
    args = ["--destination", str(root / "vale"), "--cache-dir", str(cache)]
    if archive := os.environ.get("TEST_VALE_ARCHIVE"):
        args.extend(["--archive", archive])
    receipt = run_script("install_vale.py", args, root)
    if isinstance(receipt, Rejected):
        return receipt
    status, result = receipt
    executable = result.get("executable")
    if status or result.get("type") != "INSTALLED" or not isinstance(executable, str):
        return Rejected(Reason.ENGINE, str(result.get("code", "invalid installer receipt")))
    return executable


@dataclass(frozen=True)
class Finding:
    rule: str
    message: str
    line: int
    severity: str
    passage: str


@dataclass(frozen=True)
class Document:
    report: Mapping[object, object]
    findings: tuple[Finding, ...]


def document(work: Path, name: str, data: bytes, binary: str) -> Document | Rejected:
    path = work / name
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_bytes(data)
    response = run_script(
        "assess_text.py",
        ["--vale-bin", binary, "--glossary", "docs/glossary.json", "--", name],
        work,
    )
    if isinstance(response, Rejected):
        return response
    status, report = response
    docs = report.get("documents")
    if status not in (0, 1) or report.get("type") != "ASSESSED":
        return Rejected(Reason.ASSESSMENT, str(report.get("failure", report.get("type"))))
    if not sequence(docs) or len(docs) != 1 or not mapping(docs[0]):
        return Rejected(Reason.INVALID_REPORT, "Expected one assessed document")
    doc = docs[0]
    alerts = doc.get("findings")
    if (
        doc.get("path") != name
        or doc.get("sourceSha256") != hashlib.sha256(data).hexdigest()
        or not sequence(alerts)
    ):
        return Rejected(Reason.INVALID_REPORT, "Mismatched document identity or absent findings")
    parsed = parse_alerts(alerts, data)
    if isinstance(parsed, Rejected):
        return parsed
    return Document(report, parsed)


def parse_alerts(alerts: list[object], data: bytes) -> tuple[Finding, ...] | Rejected:
    lines = data.decode().splitlines()
    findings: list[Finding] = []
    for alert in alerts:
        if not mapping(alert):
            return Rejected(Reason.INVALID_REPORT, "Invalid finding")
        rule, msg, level, line = (alert.get(key) for key in ("rule", "message", "severity", "line"))
        if not (
            isinstance(rule, str)
            and isinstance(msg, str)
            and isinstance(level, str)
            and level in {"suggestion", "warning", "error"}
            and type(line) is int
            and 1 <= line <= len(lines)
        ):
            return Rejected(Reason.INVALID_REPORT, "Invalid finding location or severity")
        findings.append(Finding(rule, msg, line, level, lines[line - 1].strip()))
    return tuple(findings)


def annotation(path: str, level: str, message: str, line: object = 1) -> None:
    def escape(value: str) -> str:
        return value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")

    prop = escape(path).replace(",", "%2C").replace(":", "%3A")
    print(f"::{level} file={prop},line={line}::{escape(message)}", file=sys.stderr)


@dataclass(frozen=True)
class Comparison:
    repo: Path
    base: str
    revision: str | None

    def read(self, work: Path, binary: str, name: str, revision: str | None) -> Document | Rejected:
        path = Path(name)
        if path.is_absolute() or ".." in path.parts or path.as_posix() != name:
            return Rejected(Reason.UNSAFE_PATH, "Expected a repository-relative path")
        try:
            raw = contents(self.repo, revision, name)
            if isinstance(raw, Rejected):
                return raw
            # Isolate revisions: a former file can be the parent directory of its new path.
            with tempfile.TemporaryDirectory(dir=work) as directory:
                snapshot = Path(directory)
                (snapshot / "docs").mkdir()
                _ = shutil.copyfile(work / "docs/glossary.json", snapshot / "docs/glossary.json")
                return document(snapshot, name, raw, binary)
        except (OSError, ValueError, subprocess.CalledProcessError) as exc:
            return Rejected(Reason.INPUT, str(exc))


def assess_change(
    target: Comparison, change: Change, work: Path, binary: str, *, annotate: bool
) -> tuple[int, dict[str, object]]:
    current = target.read(work, binary, change.path, target.revision)
    if isinstance(current, Rejected):
        if annotate:
            annotation(change.path, "error", current.detail)
        return 2, {
            "path": change.path,
            "type": "REJECTED",
            "code": current.code,
            "reason": current.detail,
        }
    prior: Counter[tuple[str, str]] = Counter()
    if (
        change.previous
        and Path(change.previous).suffix.lower() in FORMATS
        and any(f.rule == "Slopsentral.Diction" for f in current.findings)
    ):
        before = target.read(work, binary, change.previous, target.base)
        if isinstance(before, Document):
            prior.update(
                (f.message, f.passage) for f in before.findings if f.rule == "Slopsentral.Diction"
            )
    blocking: list[dict[str, object]] = []
    for finding in current.findings:
        block = finding.severity == "error"
        if finding.rule == "Slopsentral.Diction":
            key = (finding.message, finding.passage)
            block = prior[key] <= 0
            prior[key] -= 1
        if block:
            blocking.append(
                {"rule": finding.rule, "line": finding.line, "message": finding.message}
            )
        if annotate:
            annotation(
                change.path,
                "error" if block else "warning",
                f"{finding.rule}: {finding.message}",
                finding.line,
            )
    return int(bool(blocking)), {
        "path": change.path,
        "type": "ASSESSED",
        "assessment": current.report,
        "blocking": blocking,
    }


def select(target: Comparison) -> tuple[list[Change], list[dict[str, object]]]:
    selected: list[Change] = []
    excluded: list[dict[str, object]] = []
    for change in changed(target.repo, target.base, target.revision):
        if Path(change.path).suffix.lower() not in FORMATS:
            if change.previous and Path(change.previous).suffix.lower() in FORMATS:
                excluded.append(
                    {
                        "path": change.previous,
                        "type": "EXCLUDED",
                        "reason": "renamed out of prose scope",
                        "destination": change.path,
                    }
                )
            continue
        reason = "deleted" if change.deleted else exclusion(change.path)
        if reason:
            excluded.append({"path": change.path, "type": "EXCLUDED", "reason": reason})
        else:
            selected.append(change)
    return selected, excluded


def check(
    repo: Path, requested_base: str, requested_head: str | None, *, annotate: bool
) -> tuple[int, dict[str, object]]:
    head = commit(repo, requested_head or "HEAD")
    base_tip = commit(repo, requested_base)
    base = git(repo, "merge-base", base_tip, head).decode().strip()
    target = Comparison(repo, base, head if requested_head else None)
    selected, files = select(target)
    summary: dict[str, object] = {
        "base": base,
        "baseTip": base_tip,
        "head": target.revision or "WORKTREE",
        "files": files,
    }
    if not selected:
        return 0, {**summary, "type": "NO_IN_SCOPE_PROSE" if files else "NO_PROSE_CHANGES"}
    status = 0
    with tempfile.TemporaryDirectory(prefix="slopsentral-prose-") as tmp:
        root = Path(tmp)
        work = root / "documents"
        try:
            (work / "docs").mkdir(parents=True)
            _ = shutil.copyfile(POLICY / "docs/glossary.json", work / "docs/glossary.json")
            binary = engine(root)
        except (OSError, ValueError, subprocess.CalledProcessError) as exc:
            binary = Rejected(Reason.SETUP, str(exc))
        for change in selected:
            if isinstance(binary, Rejected):
                if annotate:
                    annotation(change.path, "error", binary.detail)
                files.append(
                    {
                        "path": change.path,
                        "type": "REJECTED",
                        "code": binary.code,
                        "reason": binary.detail,
                    }
                )
                status = 2
                continue
            code, entry = assess_change(target, change, work, binary, annotate=annotate)
            files.append(entry)
            status = max(status, code)
    return status, {**summary, "type": ("PASSED", "BLOCKED", "REJECTED")[status]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("command", choices=["changed"])
    _ = parser.add_argument("--base", default="origin/main")
    _ = parser.add_argument("--head", help="Read this exact commit instead of the worktree")
    _ = parser.add_argument(
        "--github", action="store_true", help="Write file annotations to stderr"
    )
    args = parser.parse_args()
    try:
        repo = Path(git(Path.cwd(), "rev-parse", "--show-toplevel").decode().rstrip("\n"))
        status, report = check(repo, args.base, args.head, annotate=args.github)
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        report, status = {"type": "REJECTED", "reason": str(exc)}, 2
    print(json.dumps(report, ensure_ascii=True))
    return status


if __name__ == "__main__":
    raise SystemExit(main())
