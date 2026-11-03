#!/usr/bin/env -S uv run --locked --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = ["markdown-it-py==4.0.0", "pyyaml==6.0.3"]
# [tool.uv]
# no-build = true
# required-version = ">=0.12.9"
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""Examine repository documentation coverage, links, and reviewed source bytes."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import tempfile
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path, PurePosixPath
from typing import TYPE_CHECKING, TypeGuard
from urllib.parse import unquote, urlsplit

import yaml
from markdown_it import MarkdownIt

if TYPE_CHECKING:
    from markdown_it.token import Token

SCHEMA_VERSION = 2
REVIEW_KIND = "KNOWLEDGE_REVIEW"
CONFIG = "docs/coverage.json"
LOCK = "docs/knowledge.lock.json"


class Code(StrEnum):
    INPUT = "INPUT"
    COVERAGE = "COVERAGE"
    LINKS = "LINKS"
    NATIVE = "NATIVE"
    OKF = "OKF"


@dataclass(frozen=True, slots=True)
class Rejected:
    code: Code
    detail: str


@dataclass(frozen=True, slots=True)
class Area:
    name: str
    sources: tuple[str, ...]
    pages: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Okf:
    root: str


@dataclass(frozen=True, slots=True)
class OpenWiki:
    root: str


type Knowledge = Okf | OpenWiki


@dataclass(frozen=True, slots=True)
class FingerprintIgnore:
    path: str
    pointers: tuple[tuple[str, ...], ...]


@dataclass(frozen=True, slots=True)
class Coverage:
    knowledge: Knowledge
    source_roots: tuple[str, ...]
    document_roots: tuple[str, ...]
    entrypoints: tuple[str, ...]
    auxiliary: tuple[str, ...]
    areas: tuple[Area, ...]
    archives: tuple[str, ...]
    ignores: tuple[FingerprintIgnore, ...]


def mapping(value: object) -> TypeGuard[Mapping[str, object]]:
    return isinstance(value, Mapping)


def sequence(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def unique(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(key)
        result[key] = value
    return result


def load(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique)


def paths(value: object) -> tuple[str, ...] | Rejected:
    if not sequence(value):
        return Rejected(Code.INPUT, "Expected path list")
    result: list[str] = []
    for item in value:
        if (
            not isinstance(item, str)
            or not item
            or "\\" in item
            or PurePosixPath(item).is_absolute()
            or ".." in item.split("/")
            or str(PurePosixPath(item)) != item.rstrip("/")
        ):
            return Rejected(Code.INPUT, f"Unsafe path: {item!r}")
        result.append(item)
    if len(result) != len(set(result)):
        return Rejected(Code.INPUT, "Duplicate paths")
    return tuple(result)


def parse_area(entry: object, knowledge: Knowledge) -> Area | Rejected:
    if not mapping(entry) or set(entry) != {"id", "sources", "pages"}:
        return Rejected(Code.INPUT, "Invalid area")
    name, sources, pages = entry["id"], paths(entry["sources"]), paths(entry["pages"])
    if isinstance(sources, Rejected):
        return sources
    if isinstance(pages, Rejected):
        return pages
    if not isinstance(name, str) or not re.fullmatch(r"[a-z][a-z0-9-]*", name):
        return Rejected(Code.INPUT, "Invalid area id")
    if not sources or not pages or not any(page.startswith(knowledge.root + "/") for page in pages):
        return Rejected(Code.COVERAGE, f"{name} needs sources and an OKF explanation")
    return Area(name, sources, pages)


def knowledge_backend(value: object) -> Knowledge | Rejected:
    if not mapping(value) or set(value) != {"type", "root"}:
        return Rejected(Code.INPUT, "Expected a knowledge backend and root")
    selected = paths([value["root"]])
    if isinstance(selected, Rejected):
        return selected
    root = selected[0].rstrip("/")
    match value["type"]:
        case "OKF":
            return Okf(root)
        case "OPENWIKI":
            return OpenWiki(root)
        case _:
            return Rejected(Code.INPUT, "Unknown knowledge backend")


def fingerprint_ignore(item: object) -> FingerprintIgnore | Rejected:
    if not mapping(item) or set(item) != {"path", "pointers"}:
        return Rejected(Code.INPUT, "Invalid fingerprint exception")
    name, raw = paths([item["path"]]), item["pointers"]
    if isinstance(name, Rejected):
        return name
    if not sequence(raw) or not raw:
        return Rejected(Code.INPUT, "Expected nonempty JSON pointers")
    pointers: list[tuple[str, ...]] = []
    for pointer in raw:
        if (
            not isinstance(pointer, str)
            or not pointer.startswith("/")
            or re.search(r"~(?![01])", pointer)
        ):
            return Rejected(Code.INPUT, "Invalid JSON pointer")
        pointers.append(
            tuple(part.replace("~1", "/").replace("~0", "~") for part in pointer[1:].split("/"))
        )
    return FingerprintIgnore(name[0], tuple(pointers))


def fingerprint_ignores(value: object) -> tuple[FingerprintIgnore, ...] | Rejected:
    if not sequence(value):
        return Rejected(Code.INPUT, "Expected fingerprintIgnores list")
    result: list[FingerprintIgnore] = []
    for item in value:
        parsed = fingerprint_ignore(item)
        if isinstance(parsed, Rejected):
            return parsed
        result.append(parsed)
    if len({item.path for item in result}) != len(result):
        return Rejected(Code.INPUT, "Duplicate fingerprint exception")
    return tuple(result)


def area_entries(value: object, knowledge: Knowledge) -> tuple[Area, ...] | Rejected:
    if not sequence(value) or not value:
        return Rejected(Code.INPUT, "Expected nonempty areas")
    areas: list[Area] = []
    for entry in value:
        parsed = parse_area(entry, knowledge)
        if isinstance(parsed, Rejected):
            return parsed
        areas.append(parsed)
    if len({area.name for area in areas}) != len(areas):
        return Rejected(Code.INPUT, "Duplicate area id")
    return tuple(areas)


def selections(value: Mapping[str, object]) -> dict[str, tuple[str, ...]] | Rejected:
    selected: dict[str, tuple[str, ...]] = {}
    for field in ("sourceRoots", "documentRoots", "entrypoints", "auxiliary", "archives"):
        parsed = paths(value[field])
        if isinstance(parsed, Rejected):
            return parsed
        selected[field] = parsed
    if not all(selected[field] for field in ("sourceRoots", "documentRoots", "entrypoints")):
        return Rejected(
            Code.INPUT, "Source roots, document roots, and entrypoints must be nonempty"
        )
    return selected


def coverage(value: object) -> Coverage | Rejected:
    fields = {
        "schemaVersion",
        "knowledge",
        "sourceRoots",
        "documentRoots",
        "entrypoints",
        "auxiliary",
        "areas",
        "archives",
        "fingerprintIgnores",
    }
    if not mapping(value) or set(value) != fields or value["schemaVersion"] != SCHEMA_VERSION:
        return Rejected(Code.INPUT, "Expected coverage schemaVersion 2")
    knowledge = knowledge_backend(value["knowledge"])
    if isinstance(knowledge, Rejected):
        return knowledge
    selected = selections(value)
    if isinstance(selected, Rejected):
        return selected
    areas, ignores = (
        area_entries(value["areas"], knowledge),
        fingerprint_ignores(value["fingerprintIgnores"]),
    )
    if isinstance(areas, Rejected):
        return areas
    if isinstance(ignores, Rejected):
        return ignores
    spec = Coverage(
        knowledge,
        selected["sourceRoots"],
        selected["documentRoots"],
        selected["entrypoints"],
        selected["auxiliary"],
        areas,
        selected["archives"],
        ignores,
    )
    return admitted_layout(spec)


def admitted_layout(spec: Coverage) -> Coverage | Rejected:
    pages = (
        *spec.entrypoints,
        *spec.auxiliary,
        *(page for area in spec.areas for page in area.pages),
    )
    if any(not matches(page, spec.document_roots) or not page.endswith(".md") for page in pages):
        return Rejected(Code.COVERAGE, "Every declared page must belong to documentRoots")
    return spec


def inventory(root: Path) -> tuple[str, ...]:
    return tuple(
        sorted(
            set(
                subprocess.check_output(
                    [
                        "git",
                        "-C",
                        str(root),
                        "ls-files",
                        "--cached",
                        "--others",
                        "--exclude-standard",
                        "-z",
                    ],
                    stderr=subprocess.PIPE,
                )
                .decode()
                .rstrip("\0")
                .split("\0")
            )
        )
    )


def matches(name: str, selections: tuple[str, ...]) -> bool:
    return any(name.startswith(item) if item.endswith("/") else name == item for item in selections)


def omit_pointer(value: object, pointer: tuple[str, ...]) -> object:
    head, *tail = pointer
    if mapping(value) and head in value:
        return {
            key: (omit_pointer(item, tuple(tail)) if key == head and tail else item)
            for key, item in value.items()
            if key != head or tail
        }
    if (
        sequence(value)
        and re.fullmatch(r"0|[1-9][0-9]*", head) is not None
        and int(head) < len(value)
    ):
        index = int(head)
        return [
            (omit_pointer(item, tuple(tail)) if offset == index and tail else item)
            for offset, item in enumerate(value)
            if offset != index or tail
        ]
    raise ValueError(pointer)


def source_bytes(name: str, data: bytes, ignores: tuple[FingerprintIgnore, ...] = ()) -> bytes:
    selected = next((item for item in ignores if item.path == name), None)
    if selected is None:
        return data
    value: object = json.loads(data, object_pairs_hook=unique)
    for pointer in selected.pointers:
        value = omit_pointer(value, pointer)
    return json.dumps(value, sort_keys=True).encode()


def digest(root: Path, name: str, ignores: tuple[FingerprintIgnore, ...] = ()) -> str:
    target = root / name
    if target.resolve() != root.resolve() / name or not target.is_file():
        raise ValueError(name)
    return hashlib.sha256(source_bytes(name, target.read_bytes(), ignores)).hexdigest()


def tokens(text: str) -> list[Token]:
    if text.startswith("---\n"):
        _, separator, text = text[4:].partition("\n---\n")
        if not separator:
            raise ValueError(Code.OKF)
    return MarkdownIt().parse(text)


def links(items: list[Token]) -> tuple[str, ...]:
    result: list[str] = []
    for token in items:
        result.extend(
            target for key in ("href", "src") if isinstance(target := token.attrGet(key), str)
        )
        if token.children:
            result.extend(links(token.children))
    return tuple(result)


def anchors(items: list[Token]) -> set[str]:
    result: set[str] = set()
    counts: dict[str, int] = {}
    for index, token in enumerate(items):
        if token.type == "heading_open":
            title = items[index + 1].content.lower().replace("`", "")
            base = re.sub(r"[^\w\- ]", "", title).replace(" ", "-")
            count = counts.get(base, 0)
            result.add(f"{base}-{count}" if count else base)
            counts[base] = count + 1
    return result


def examine_links(root: Path, pages: tuple[str, ...], spec: Coverage) -> Rejected | None:
    parsed = {name: tokens((root / name).read_text(encoding="utf-8")) for name in pages}
    edges: dict[str, set[str]] = {name: set() for name in pages}
    for name, items in parsed.items():
        for link in links(items):
            target = urlsplit(link)
            if target.scheme or target.netloc:
                continue
            path = unquote(target.path)
            if path.startswith("/"):
                destination = (
                    root / spec.knowledge.root / path.lstrip("/")
                    if name.startswith(spec.knowledge.root + "/")
                    else root / path.lstrip("/")
                )
            else:
                destination = (root / name).parent / path if path else root / name
            destination = destination.resolve()
            if not destination.is_relative_to(root.resolve()) or not destination.exists():
                return Rejected(Code.LINKS, f"{name}: {link}")
            if destination.is_dir() and (destination / "index.md").is_file():
                destination /= "index.md"
            relative = destination.relative_to(root.resolve()).as_posix()
            if relative in parsed:
                edges[name].add(relative)
            if target.fragment and destination.suffix == ".md":
                relative = destination.relative_to(root.resolve()).as_posix()
                headings = anchors(
                    parsed[relative]
                    if relative in parsed
                    else tokens(destination.read_text(encoding="utf-8"))
                )
                if unquote(target.fragment) not in headings:
                    return Rejected(Code.LINKS, f"{name}: missing anchor {link}")
    return reachable(edges, pages, spec)


def reachable(
    edges: dict[str, set[str]], pages: tuple[str, ...], spec: Coverage
) -> Rejected | None:
    reached: set[str] = set()
    pending = {name for name in spec.entrypoints if name in edges}
    while pending:
        name = pending.pop()
        if name not in reached:
            reached.add(name)
            pending.update(edges[name] - reached)
    unreachable = sorted(set(pages) - reached - set(spec.auxiliary))
    if unreachable:
        return Rejected(Code.LINKS, f"Unreachable pages: {', '.join(unreachable)}")
    return None


def native(root: Path, pages: tuple[str, ...], spec: Coverage) -> Rejected | None:
    knowledge = spec.knowledge
    if isinstance(knowledge, OpenWiki):
        status = load(root / knowledge.root / ".last-update.json")
        if (
            not mapping(status)
            or status.get("status") != "complete"
            or (root / knowledge.root / ".run.json").exists()
        ):
            return Rejected(Code.NATIVE, "Complete the OpenWiki page queue and finish")
    for name in pages:
        if (
            not name.startswith(knowledge.root + "/")
            or Path(name).name in {"index.md", "log.md"}
            or name in spec.auxiliary
        ):
            continue
        text = (root / name).read_text(encoding="utf-8")
        if not text.startswith("---\n") or "\n---\n" not in text[4:]:
            return Rejected(Code.OKF, name)
        metadata: object = yaml.safe_load(text[4:].split("\n---\n", 1)[0])
        if not mapping(metadata) or not all(
            isinstance(metadata.get(key), str) and str(metadata[key]).strip()
            for key in ("type", "title", "description")
        ):
            return Rejected(Code.OKF, name)
        if isinstance(knowledge, OpenWiki):
            sidecar = (
                root
                / knowledge.root
                / ".claims"
                / Path(name).relative_to(knowledge.root).with_suffix(".json")
            )
            content = load(sidecar)
            if not mapping(content) or not sequence(content.get("claims")) or not content["claims"]:
                return Rejected(Code.NATIVE, f"Missing material Claims: {name}")
    return None


def declared_inputs(spec: Coverage, files: tuple[str, ...]) -> Rejected | None:
    for selection in spec.source_roots:
        if not any(matches(name, (selection,)) for name in files):
            return Rejected(Code.COVERAGE, f"Empty source root: {selection}")
    for rule in spec.ignores:
        if rule.path not in files or not any(
            matches(rule.path, area.sources) for area in spec.areas
        ):
            return Rejected(Code.INPUT, f"Fingerprint exception lacks selected input: {rule.path}")
    return None


def snapshot(
    root: Path, spec: Coverage, files: tuple[str, ...]
) -> dict[str, dict[str, str]] | Rejected:
    admitted = declared_inputs(spec, files)
    if admitted:
        return admitted
    areas: dict[str, dict[str, str]] = {}
    all_pages = tuple(
        name for name in files if matches(name, spec.document_roots) and name.endswith(".md")
    )
    if not all_pages or any(name not in all_pages for name in spec.entrypoints):
        return Rejected(Code.COVERAGE, "Missing documentation or entrypoint")
    owned = (
        {page for area in spec.areas for page in area.pages}
        | set(spec.archives)
        | set(spec.entrypoints)
        | set(spec.auxiliary)
    )
    unowned = [
        name
        for name in all_pages
        if name not in owned and Path(name).name not in {"index.md", "log.md"}
    ]
    uncovered = [
        name
        for name in files
        if matches(name, spec.source_roots)
        and not any(matches(name, area.sources) for area in spec.areas)
    ]
    if unowned or uncovered:
        return Rejected(Code.COVERAGE, f"Unmapped paths: {', '.join(unowned + uncovered)}")
    for area in spec.areas:
        selected = tuple(name for name in files if matches(name, area.sources))
        for source in area.sources:
            if not any(matches(name, (source,)) for name in selected):
                return Rejected(Code.COVERAGE, f"Empty source selection: {source}")
        areas[area.name] = {
            name: digest(root, name, spec.ignores) for name in sorted({*selected, *area.pages})
        }
    for rejection in (
        native(root, all_pages, spec),
        examine_links(root, tuple(name for name in all_pages if name not in spec.archives), spec),
    ):
        if rejection:
            return rejection
    native_records = tuple(
        name
        for name in files
        if name.startswith(spec.knowledge.root + "/.claims/")
        or name
        in {
            spec.knowledge.root + "/.page-manifest.json",
            spec.knowledge.root + "/.last-update.json",
        }
    )
    areas["navigation"] = {
        name: digest(root, name)
        for name in (*all_pages, *native_records)
        if name not in spec.archives
    }
    return areas


def compare(previous: object, state: Mapping[str, object]) -> tuple[int, dict[str, object]]:
    if not mapping(previous) or not mapping(old_areas := previous.get("areas")):
        return 2, {"type": "REJECTED", "code": Code.INPUT, "detail": "Invalid knowledge lock"}
    current = state["areas"]
    if not mapping(current):
        return 2, {"type": "REJECTED", "code": Code.INPUT, "detail": "Invalid prepared areas"}
    affected: dict[str, list[str]] = {}
    for area in sorted(set(current) | set(old_areas)):
        old = old_areas.get(area, {})
        if not mapping(old):
            return 2, {"type": "REJECTED", "code": Code.INPUT, "detail": "Invalid locked area"}
        now = current.get(area, {})
        if not mapping(now):
            return 2, {"type": "REJECTED", "code": Code.INPUT, "detail": "Invalid prepared area"}
        changes = [name for name in sorted(set(old) | set(now)) if old.get(name) != now.get(name)]
        if changes:
            affected[area] = changes
    return 1, {
        "type": "STALE",
        "detail": "Review affected explanations and run record",
        "affected": affected,
        "coverageChanged": previous.get("coverageSha256") != state["coverageSha256"],
    }


def configuration_bytes(root: Path, config_name: str, lock_name: str) -> bytes | Rejected:
    safe = paths([config_name, lock_name])
    if isinstance(safe, Rejected):
        return safe
    for name in safe:
        if (root / name).resolve() != root.resolve() / name:
            return Rejected(Code.INPUT, f"Indirect configuration or lock: {name}")
    return (root / config_name).read_bytes()


def prepared(root: Path, config_name: str, lock_name: str) -> dict[str, object] | Rejected:
    raw = configuration_bytes(root, config_name, lock_name)
    if isinstance(raw, Rejected):
        return raw
    spec = coverage(json.loads(raw, object_pairs_hook=unique))
    if isinstance(spec, Rejected):
        return spec
    if any(matches(lock_name, area.sources) for area in spec.areas):
        return Rejected(Code.INPUT, "The review lock cannot fingerprint itself")
    current = snapshot(root, spec, inventory(root))
    if isinstance(current, Rejected):
        return current
    if any(lock_name in files for files in current.values()):
        return Rejected(Code.INPUT, "The review lock cannot replace a prepared input")
    return {
        "type": REVIEW_KIND,
        "schemaVersion": SCHEMA_VERSION,
        "coverageSha256": hashlib.sha256(raw).hexdigest(),
        "areas": current,
    }


@dataclass(frozen=True, slots=True)
class _RecordTarget:
    path: Path


def review_record(value: object) -> TypeGuard[Mapping[str, object]]:
    if not mapping(value) or set(value) != {"type", "schemaVersion", "coverageSha256", "areas"}:
        return False
    if value["type"] != REVIEW_KIND or value["schemaVersion"] != SCHEMA_VERSION:
        return False
    checksum, areas = value["coverageSha256"], value["areas"]
    if (
        not isinstance(checksum, str)
        or not re.fullmatch(r"[0-9a-f]{64}", checksum)
        or not mapping(areas)
        or not areas
    ):
        return False
    return all(
        mapping(files)
        and all(
            isinstance(checksum, str) and re.fullmatch(r"[0-9a-f]{64}", checksum)
            for checksum in files.values()
        )
        for files in areas.values()
    )


def record_target(path: Path) -> _RecordTarget | Rejected:
    if path.exists() and not review_record(load(path)):
        return Rejected(Code.INPUT, "The existing target is not an owned knowledge review lock")
    return _RecordTarget(path)


def record(target: _RecordTarget, state: Mapping[str, object]) -> None:
    path = target.path
    with tempfile.TemporaryDirectory(dir=path.parent, prefix=".knowledge-") as directory:
        temporary = Path(directory) / "review.json"
        _ = temporary.write_text(
            json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
        )
        _ = temporary.replace(path)


def run(
    root: Path, command: str, config_name: str = CONFIG, lock_name: str = LOCK
) -> tuple[int, dict[str, object]]:
    try:
        state = prepared(root, config_name, lock_name)
        if isinstance(state, Rejected):
            return 2, {"type": "REJECTED", "code": state.code, "detail": state.detail}
        if command == "record":
            return write_review(root / lock_name, state)
        previous = load(root / lock_name)
        if not review_record(previous):
            return 2, {
                "type": "REJECTED",
                "code": Code.INPUT,
                "detail": "Invalid knowledge review lock",
            }
        if previous == state:
            return 0, {"type": "CURRENT", "areas": sorted_area_names(state)}
        return compare(previous, state)
    except (OSError, ValueError, yaml.YAMLError, subprocess.CalledProcessError) as exc:
        return 2, {"type": "REJECTED", "code": Code.INPUT, "detail": str(exc)}


def write_review(path: Path, state: Mapping[str, object]) -> tuple[int, dict[str, object]]:
    target = record_target(path)
    if isinstance(target, Rejected):
        return 2, {"type": "REJECTED", "code": target.code, "detail": target.detail}
    record(target, state)
    return 0, {
        "type": "RECORDED",
        "areas": sorted_area_names(state),
        "limit": "Records reviewed bytes, not semantic correctness",
    }


def sorted_area_names(state: Mapping[str, object]) -> list[str]:
    areas = state["areas"]
    if not mapping(areas):
        raise ValueError(Code.INPUT)
    return sorted(areas)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("command", choices=["check", "record"])
    _ = parser.add_argument("--repo", type=Path, default=Path.cwd())
    _ = parser.add_argument(
        "--config", default=CONFIG, help="Repository-relative coverage configuration"
    )
    _ = parser.add_argument(
        "--lock", default=LOCK, help="Repository-relative reviewed fingerprints"
    )
    args = parser.parse_args()
    code, report = run(args.repo.resolve(), args.command, args.config, args.lock)
    print(json.dumps(report))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
