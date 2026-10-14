#!/usr/bin/env python3
"""Assess English prose with one pinned Vale policy and the canonical glossary."""

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from check_glossary import check


SKILL = Path(__file__).resolve().parents[1]
POLICY = SKILL / "assets/vale"
VERSION = "3.24.0"


class Failure(Enum):
    INVALID_INPUT = "INVALID_INPUT"
    INVALID_GLOSSARY = "INVALID_GLOSSARY"
    POLICY_DRIFT = "POLICY_DRIFT"
    POLICY_OVERRIDE = "POLICY_OVERRIDE"
    VALE_UNAVAILABLE = "VALE_UNAVAILABLE"
    VALE_VERSION_MISMATCH = "VALE_VERSION_MISMATCH"
    VALE_FAILED = "VALE_FAILED"
    INVALID_VALE_OUTPUT = "INVALID_VALE_OUTPUT"
    NO_PROSE = "NO_PROSE"


class Stage(Enum):
    INPUT = "INPUT"
    GLOSSARY = "GLOSSARY"
    POLICY = "POLICY"
    VERSION = "VERSION"
    METRICS = "METRICS"
    LINT = "LINT"
    WORKSPACE = "WORKSPACE"


@dataclass(frozen=True)
class Rejected:
    failure: Failure
    stage: Stage

    def report(self):
        return {"type": "REJECTED", "schemaVersion": 1,
                "failure": {"type": self.failure.value, "stage": self.stage.value}}


@dataclass(frozen=True)
class Metrics:
    words: int
    sentences: int
    syllables: int
    grade: float

    def report(self):
        return {"words": self.words, "sentences": self.sentences,
                "estimatedSyllables": self.syllables,
                "wordsPerSentence": round(self.words / self.sentences, 2),
                "fleschKincaidGrade": self.grade}


def parse_metrics(payload):
    if not isinstance(payload, dict):
        return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.METRICS)
    if payload == {}:
        return Rejected(Failure.NO_PROSE, Stage.METRICS)
    counts = [payload.get(key) for key in ("words", "sentences", "syllables")]
    if any(type(value) is not int or value < 0 for value in counts):
        return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.METRICS)
    words, sentences, syllables = counts
    if not words or not sentences:
        return Rejected(Failure.NO_PROSE, Stage.METRICS)
    grade = payload.get("flesch_kincaid")
    if type(grade) not in (int, float):
        return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.METRICS)
    try:
        if not math.isfinite(grade):
            return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.METRICS)
        # Independently check the published formula against Vale's estimate.
        expected = round(0.39 * words / sentences + 11.8 * syllables / words - 15.59, 2)
    except OverflowError:
        return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.METRICS)
    if abs(grade - expected) > 0.011:
        return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.METRICS)
    return Metrics(words, sentences, syllables, grade)


def run_vale(binary, arguments, environment, stage):
    try:
        result = subprocess.run([binary, "--no-global", *arguments],
                                capture_output=True, text=True, encoding="utf-8",
                                errors="strict", env=environment, timeout=30)
    except (OSError, subprocess.TimeoutExpired, UnicodeError):
        return Rejected(Failure.VALE_FAILED, stage)
    if result.returncode != 0:
        return Rejected(Failure.VALE_FAILED, stage)
    return result.stdout


def read_json(text, stage):
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate JSON field")
            result[key] = value
        return result

    def reject_constant(_value):
        raise ValueError("Nonfinite JSON number")

    try:
        return json.loads(text, object_pairs_hook=unique_object, parse_constant=reject_constant)
    except (ValueError, TypeError):
        return Rejected(Failure.INVALID_VALE_OUTPUT, stage)


def verify_policy():
    try:
        lock_bytes = (POLICY / "resources.lock.json").read_bytes()
        lock = read_json(lock_bytes.decode("utf-8", errors="strict"), Stage.POLICY)
        if not isinstance(lock, dict):
            return Rejected(Failure.POLICY_DRIFT, Stage.POLICY)
        if set(lock) != {"type", "schemaVersion", "valeVersion", "files", "upstream"}:
            return Rejected(Failure.POLICY_DRIFT, Stage.POLICY)
        if (lock["type"] != "VALE_POLICY_LOCK" or type(lock["schemaVersion"]) is not int or
                lock["schemaVersion"] != 1 or lock["valeVersion"] != VERSION):
            return Rejected(Failure.POLICY_DRIFT, Stage.POLICY)
        if not isinstance(lock["files"], dict) or not isinstance(lock["upstream"], list):
            return Rejected(Failure.POLICY_DRIFT, Stage.POLICY)
        for source in lock["upstream"]:
            if (not isinstance(source, dict) or set(source) != {"repository", "revision"} or
                    source["repository"] not in ("vale-cli/Std", "vale-cli/readability", "vale-cli/Google") or
                    not isinstance(source["revision"], str) or
                    not re.fullmatch(r"[a-f0-9]{40}", source["revision"])):
                return Rejected(Failure.POLICY_DRIFT, Stage.POLICY)
        if sorted(source["repository"] for source in lock["upstream"]) != [
                "vale-cli/Google", "vale-cli/Std", "vale-cli/readability"]:
            return Rejected(Failure.POLICY_DRIFT, Stage.POLICY)
        actual = {str(path.relative_to(POLICY)) for path in POLICY.rglob("*")
                  if path.is_file() and path.name != "resources.lock.json"}
        if actual != set(lock["files"]):
            return Rejected(Failure.POLICY_DRIFT, Stage.POLICY)
        for name, digest in lock["files"].items():
            if not re.fullmatch(r"[a-f0-9]{64}", digest):
                return Rejected(Failure.POLICY_DRIFT, Stage.POLICY)
            if hashlib.sha256((POLICY / name).read_bytes()).hexdigest() != digest:
                return Rejected(Failure.POLICY_DRIFT, Stage.POLICY)
    except (OSError, UnicodeError, ValueError, TypeError, KeyError):
        return Rejected(Failure.POLICY_DRIFT, Stage.POLICY)
    return hashlib.sha256(lock_bytes).hexdigest()


def glossary_rules(entries):
    swaps = {}
    for term, entry in entries.items():
        swaps[re.escape(term)] = term
        for synonym in entry["synonyms"]:
            swaps[re.escape(synonym)] = term
    # JSON flow mappings are valid YAML and preserve literal, argument-safe terms.
    return ("extends: substitution\nlevel: error\nignorecase: true\n"
            "action:\n  name: replace\n"
            "message: \"Use the canonical spelling '%s' instead of '%s', or clarify its meaning.\"\n"
            "swap: " + json.dumps(swaps, ensure_ascii=True) + "\n")


CATEGORIES = {"Slopsentral.Grade": "READABILITY", "Slopsentral.LongSentence": "STRUCTURE",
              "Slopsentral.Diction": "DICTION", "Slopsentral.Claims": "DICTION",
              "Slopsentral.Terminology": "TERMINOLOGY",
              "Slopsentral.GlossaryMarker": "TERMINOLOGY"}


def parse_findings(payload, expected_path):
    if not isinstance(payload, dict) or len(payload) > 1:
        return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.LINT)
    if payload == {}:
        return []
    if set(payload) != {expected_path}:
        return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.LINT)
    alerts = next(iter(payload.values()))
    if not isinstance(alerts, list):
        return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.LINT)
    findings = []
    for alert in alerts:
        if not isinstance(alert, dict):
            return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.LINT)
        rule, line, span = alert.get("Check"), alert.get("Line"), alert.get("Span")
        if not isinstance(rule, str) or rule not in CATEGORIES or type(line) is not int or line < 1:
            return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.LINT)
        if (not isinstance(span, list) or len(span) != 2 or
                any(type(value) is not int or value < 1 for value in span) or span[1] < span[0]):
            return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.LINT)
        if alert.get("Severity") not in ("suggestion", "warning", "error"):
            return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.LINT)
        message = alert.get("Message")
        if not isinstance(message, str) or not message or len(message) > 2000:
            return Rejected(Failure.INVALID_VALE_OUTPUT, Stage.LINT)
        findings.append({"type": "FINDING", "category": CATEGORIES[rule], "rule": rule,
                         "severity": alert["Severity"], "line": line, "span": span,
                         "message": message})
    return sorted(findings, key=lambda item: (item["line"], item["span"], item["rule"]))


def assess(paths, glossary, binary):
    policy_digest = verify_policy()
    if isinstance(policy_digest, Rejected):
        return policy_digest
    resolved_binary = shutil.which(binary)
    if resolved_binary is None:
        return Rejected(Failure.VALE_UNAVAILABLE, Stage.VERSION)
    environment = {key: value for key, value in os.environ.items() if not key.startswith("VALE_")}
    version = run_vale(resolved_binary, ["--version"], environment, Stage.VERSION)
    if isinstance(version, Rejected):
        return version
    if version.strip() != "vale version " + VERSION:
        return Rejected(Failure.VALE_VERSION_MISMATCH, Stage.VERSION)

    entries = {}
    glossary_digest = None
    documents = []
    with tempfile.TemporaryDirectory(prefix="text-assessment-") as directory:
        root = Path(directory)
        if glossary is not None:
            try:
                glossary_bytes = glossary.read_bytes()
                glossary_bytes.decode("utf-8", errors="strict")
                frozen_glossary = root / "GLOSSARY.md"
                frozen_glossary.write_bytes(glossary_bytes)
                entries, errors = check(frozen_glossary, [])
            except (OSError, UnicodeError):
                return Rejected(Failure.INVALID_GLOSSARY, Stage.GLOSSARY)
            if errors:
                return Rejected(Failure.INVALID_GLOSSARY, Stage.GLOSSARY)
            glossary_digest = hashlib.sha256(glossary_bytes).hexdigest()
        shutil.copytree(POLICY / "styles", root / "styles")
        config = root / ".vale.ini"
        config.write_bytes((POLICY / ".vale.ini").read_bytes())
        if entries:
            (root / "styles/Slopsentral/Terminology.yml").write_text(
                glossary_rules(entries), encoding="utf-8")
        for path in paths:
            try:
                if not path.is_file() or path.suffix.lower() not in (".md", ".mdx", ".txt"):
                    return Rejected(Failure.INVALID_INPUT, Stage.INPUT)
                text = path.read_bytes().decode("utf-8", errors="strict")
            except (OSError, UnicodeError):
                return Rejected(Failure.INVALID_INPUT, Stage.INPUT)
            if re.search(r"<!--\s*vale\b", text, re.IGNORECASE):
                return Rejected(Failure.POLICY_OVERRIDE, Stage.INPUT)
            # Freeze the input once; metrics and findings must assess the same bytes.
            snapshot = root / ("input" + path.suffix.lower())
            snapshot.write_bytes(text.encode("utf-8"))
            common = ["--config", str(config)]
            raw_metrics = run_vale(resolved_binary, [*common, "ls-metrics", str(snapshot)],
                                   environment, Stage.METRICS)
            if isinstance(raw_metrics, Rejected):
                return raw_metrics
            payload = read_json(raw_metrics, Stage.METRICS)
            if isinstance(payload, Rejected):
                return payload
            metrics = parse_metrics(payload)
            if isinstance(metrics, Rejected):
                return metrics
            raw_alerts = run_vale(resolved_binary,
                                  [*common, "--output=JSON", "--no-exit", str(snapshot)],
                                  environment, Stage.LINT)
            if isinstance(raw_alerts, Rejected):
                return raw_alerts
            payload = read_json(raw_alerts, Stage.LINT)
            if isinstance(payload, Rejected):
                return payload
            findings = parse_findings(payload, str(snapshot))
            if isinstance(findings, Rejected):
                return findings
            documents.append({"type": "DOCUMENT_ASSESSMENT", "path": str(path),
                              "sourceSha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
                              "metrics": metrics.report(), "findings": findings})
    return {"type": "ASSESSED" if glossary is not None else "INCOMPLETE", "schemaVersion": 1,
            "engine": {"type": "VALE", "version": VERSION, "policySha256": policy_digest},
            "glossary": ({"type": "CHECKED", "entries": len(entries),
                          "sourceSha256": glossary_digest} if glossary is not None
                         else {"type": "NOT_PROVIDED"}),
            "comprehension": {"type": "NOT_ASSESSED"}, "documents": documents}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vale-bin", default="vale", help="Vale 3.24.0 executable")
    parser.add_argument("--glossary", type=Path, help="Canonical repository glossary")
    parser.add_argument("documents", type=Path, nargs="+")
    args = parser.parse_args()
    try:
        result = assess(args.documents, args.glossary, args.vale_bin)
    except OSError:
        result = Rejected(Failure.VALE_FAILED, Stage.WORKSPACE)
    if isinstance(result, Rejected):
        report, code = result.report(), 2
    else:
        report = result
        code = (2 if result["type"] == "INCOMPLETE" else
                1 if any(document["findings"] for document in result["documents"]) else 0)
    print(json.dumps(report, ensure_ascii=True, sort_keys=True, indent=2, allow_nan=False))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
