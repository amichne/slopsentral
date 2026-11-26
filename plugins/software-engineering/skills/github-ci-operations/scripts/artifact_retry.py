#!/usr/bin/env -S uv run --locked --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = ["pyyaml==6.0.3"]
# [tool.uv]
# no-build = true
# required-version = ">=0.12.9"
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""Examine one same-run upload/download edge under a consumer-only retry."""

import argparse
import hashlib
import json
import re
from enum import StrEnum
from pathlib import Path
from typing import TypeGuard

import yaml


class Outcome(StrEnum):
    MATCH = "MATCH"
    SELECTOR_MISMATCH = "SELECTOR_MISMATCH"
    UNRESOLVED = "UNRESOLVED"
    EXPIRED = "EXPIRED"
    FOREIGN_TREE = "FOREIGN_TREE"
    WRONG_ARTIFACT = "WRONG_ARTIFACT"
    DIGEST_MISMATCH = "DIGEST_MISMATCH"
    BYTES_MATCH = "BYTES_MATCH"


class UnsupportedError(ValueError):
    """The selector falls outside the supported workflow grammar."""


def mapping(value: object) -> TypeGuard[dict[object, object]]:
    return isinstance(value, dict)


def fields(value: object) -> dict[object, object]:
    if not mapping(value):
        raise UnsupportedError
    return value


def sequence(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def actions(job: dict[object, object], name: str) -> list[dict[object, object]]:
    steps = job.get("steps")
    if not sequence(steps):
        raise UnsupportedError
    return [
        fields(step)
        for step in steps
        if str(fields(step).get("uses", "")).startswith(f"actions/{name}-artifact@")
    ]


def artifact_name(value: object, attempt: int) -> str:
    if not isinstance(value, str) or not value:
        raise UnsupportedError
    name = re.sub(r"\$\{\{\s*github\.run_id\s*\}\}", "\x00run-id", value)
    name = re.sub(r"\$\{\{\s*github\.run_attempt\s*\}\}", str(attempt), name)
    if "${{" in name:
        raise UnsupportedError
    return name


def selectors(
    document: object, producer: str, consumer: str, upload: int, download: int
) -> list[Outcome]:
    jobs = fields(fields(document)["jobs"])
    source, target = fields(jobs[producer]), fields(jobs[consumer])
    needs = target.get("needs")
    if not (needs == producer or (sequence(needs) and producer in needs)):
        raise UnsupportedError
    uploads = actions(source, "upload")
    downloads = actions(target, "download")
    if not 1 <= download <= len(downloads) or not 1 <= upload <= len(uploads):
        raise UnsupportedError
    intended = uploads[upload - 1]
    selector = fields(downloads[download - 1].get("with"))
    if set(selector) - {"name", "artifact-ids", "path"}:
        raise UnsupportedError
    if "artifact-ids" in selector:
        output = re.fullmatch(
            rf"\$\{{\{{\s*needs\.{re.escape(producer)}\.outputs\.([\w-]+)\s*\}}\}}",
            str(selector["artifact-ids"]),
        )
        if not output or "name" in selector:
            raise UnsupportedError
        binding = fields(source.get("outputs")).get(output[1])
        step = re.fullmatch(r"\$\{\{\s*steps\.([\w-]+)\.outputs\.artifact-id\s*\}\}", str(binding))
        if (
            not step
            or intended.get("id") != step[1]
            or sum(item.get("id") == step[1] for item in uploads) != 1
        ):
            raise UnsupportedError
        return [Outcome.MATCH, Outcome.MATCH]
    expected = artifact_name(fields(intended.get("with")).get("name"), 1)
    return [
        Outcome.MATCH
        if expected == artifact_name(selector.get("name"), attempt)
        else Outcome.SELECTOR_MISMATCH
        for attempt in (1, 2)
    ]


def examine_bytes(
    record: object, artifact_id: int, tree: str, producer_tree: str, archive: Path
) -> Outcome:
    artifact = fields(record)
    if type(artifact.get("id")) is not int or artifact["id"] != artifact_id or artifact_id < 1:
        return Outcome.WRONG_ARTIFACT
    if artifact.get("expired") is True:
        return Outcome.EXPIRED
    if artifact.get("expired") is not False or not re.fullmatch(r"[0-9a-f]{40}", tree):
        raise UnsupportedError
    if producer_tree != tree:
        return Outcome.FOREIGN_TREE
    digest = artifact.get("digest")
    if not isinstance(digest, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
        raise UnsupportedError
    with archive.open("rb") as stream:
        actual = hashlib.file_digest(stream, "sha256").hexdigest()
    return Outcome.BYTES_MATCH if digest == f"sha256:{actual}" else Outcome.DIGEST_MISMATCH


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    edge = commands.add_parser("edge")
    _ = edge.add_argument("workflow", type=Path)
    _ = edge.add_argument("producer")
    _ = edge.add_argument("consumer")
    _ = edge.add_argument("--upload", type=int, default=1, help="one-based upload action number")
    _ = edge.add_argument(
        "--download", type=int, default=1, help="one-based download action number"
    )
    payload = commands.add_parser("bytes")
    _ = payload.add_argument("metadata", type=Path)
    _ = payload.add_argument("artifact_id", type=int)
    _ = payload.add_argument("expected_tree")
    _ = payload.add_argument("producer_tree")
    _ = payload.add_argument("archive", type=Path)
    try:
        args = parser.parse_args()
        if args.command == "edge":
            document: object = yaml.safe_load(args.workflow.read_text())
            outcomes = selectors(document, args.producer, args.consumer, args.upload, args.download)
            print(json.dumps(dict(zip(("sameAttempt", "consumerRetry"), outcomes, strict=True))))
            return int(outcomes != [Outcome.MATCH, Outcome.MATCH])
        outcome = examine_bytes(
            json.loads(args.metadata.read_text()),
            args.artifact_id,
            args.expected_tree,
            args.producer_tree,
            args.archive,
        )
    except (KeyError, OSError, ValueError, yaml.YAMLError):
        outcome = Outcome.UNRESOLVED
    print(json.dumps({"outcome": outcome}))
    return int(outcome is not Outcome.BYTES_MATCH)


if __name__ == "__main__":
    raise SystemExit(main())
