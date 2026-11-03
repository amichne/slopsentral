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

CONFIG = "docs/coverage.json"
LOCK = "docs/knowledge.lock.json"
SOURCE_ROOTS = ("source/", "tools/", ".github/workflows/")


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
class Coverage:
    areas: tuple[Area, ...]
    archives: tuple[str, ...]


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
    return json.loads(path.read_text(), object_pairs_hook=unique)


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


def parse_area(entry: object) -> Area | Rejected:
    if not mapping(entry) or set(entry) != {"id", "sources", "pages"}:
        return Rejected(Code.INPUT, "Invalid area")
    name, sources, pages = entry["id"], paths(entry["sources"]), paths(entry["pages"])
    if isinstance(sources, Rejected):
        return sources
    if isinstance(pages, Rejected):
        return pages
    if not isinstance(name, str) or not re.fullmatch(r"[a-z][a-z0-9-]*", name):
        return Rejected(Code.INPUT, "Invalid area id")
    if not sources or not pages or not any(page.startswith("openwiki/") for page in pages):
        return Rejected(Code.COVERAGE, f"{name} needs sources and an OKF explanation")
    return Area(name, sources, pages)


def coverage(value: object) -> Coverage | Rejected:
    if not mapping(value) or set(value) != {"schemaVersion", "areas", "archives"}:
        return Rejected(Code.INPUT, CONFIG)
    entries, archives = value["areas"], paths(value["archives"])
    if value["schemaVersion"] != 1 or not sequence(entries) or not entries:
        return Rejected(Code.INPUT, "Expected schemaVersion 1 and nonempty areas")
    if isinstance(archives, Rejected):
        return archives
    areas: list[Area] = []
    for entry in entries:
        parsed = parse_area(entry)
        if isinstance(parsed, Rejected):
            return parsed
        areas.append(parsed)
    if len({area.name for area in areas}) != len(areas):
        return Rejected(Code.INPUT, "Duplicate area id")
    return Coverage(tuple(areas), archives)


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


def source_bytes(name: str, data: bytes) -> bytes:
    # Product-version-only increments do not change the documented mechanism.
    if name == "source/adaptable.marketplace.json":
        value: object = json.loads(data, object_pairs_hook=unique)
        if not mapping(value) or not sequence(plugins := value.get("plugins")):
            raise ValueError(Code.INPUT)
        entries: list[object] = []
        for entry in plugins:
            if not mapping(entry) or not mapping(plugin := entry.get("plugin")):
                raise ValueError(Code.INPUT)
            entries.append(
                {**entry, "plugin": {key: item for key, item in plugin.items() if key != "version"}}
            )
        return json.dumps({**value, "plugins": entries}, sort_keys=True).encode()
    if re.fullmatch(r"source/plugins/[^/]+/plugin[.]json", name):
        value = json.loads(data, object_pairs_hook=unique)
        if not mapping(value):
            raise ValueError(Code.INPUT)
        return json.dumps(
            {key: item for key, item in value.items() if key != "version"}, sort_keys=True
        ).encode()
    return data


def digest(root: Path, name: str) -> str:
    target = root / name
    if target.resolve() != root.resolve() / name or not target.is_file():
        raise ValueError(name)
    return hashlib.sha256(source_bytes(name, target.read_bytes())).hexdigest()


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


def examine_links(root: Path, pages: tuple[str, ...]) -> Rejected | None:
    parsed = {name: tokens((root / name).read_text()) for name in pages}
    edges: dict[str, set[str]] = {name: set() for name in pages}
    for name, items in parsed.items():
        for link in links(items):
            target = urlsplit(link)
            if target.scheme or target.netloc:
                continue
            path = unquote(target.path)
            if path.startswith("/"):
                destination = (
                    root / "openwiki" / path.lstrip("/")
                    if name.startswith("openwiki/")
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
                    parsed[relative] if relative in parsed else tokens(destination.read_text())
                )
                if unquote(target.fragment) not in headings:
                    return Rejected(Code.LINKS, f"{name}: missing anchor {link}")
    return reachable(edges, pages)


def reachable(edges: dict[str, set[str]], pages: tuple[str, ...]) -> Rejected | None:
    reached: set[str] = set()
    pending = {
        name for name in ("README.md", "docs/index.md", "openwiki/index.md") if name in edges
    }
    while pending:
        name = pending.pop()
        if name not in reached:
            reached.add(name)
            pending.update(edges[name] - reached)
    unreachable = sorted(set(pages) - reached - {"openwiki/INSTRUCTIONS.md"})
    if unreachable:
        return Rejected(Code.LINKS, f"Unreachable pages: {', '.join(unreachable)}")
    return None


def native(root: Path, pages: tuple[str, ...]) -> Rejected | None:
    status = load(root / "openwiki/.last-update.json")
    if (
        not mapping(status)
        or status.get("status") != "complete"
        or (root / "openwiki/.run.json").exists()
    ):
        return Rejected(Code.NATIVE, "Complete the OpenWiki page queue and finish")
    for name in pages:
        if not name.startswith("openwiki/") or Path(name).name in {
            "index.md",
            "INSTRUCTIONS.md",
            "log.md",
        }:
            continue
        text = (root / name).read_text()
        if not text.startswith("---\n"):
            return Rejected(Code.OKF, name)
        metadata: object = yaml.safe_load(text[4:].split("\n---\n", 1)[0])
        if not mapping(metadata) or not all(
            isinstance(metadata.get(key), str) and str(metadata[key]).strip()
            for key in ("type", "title", "description")
        ):
            return Rejected(Code.OKF, name)
        sidecar = (
            root / "openwiki/.claims" / Path(name).relative_to("openwiki").with_suffix(".json")
        )
        content = load(sidecar)
        if not mapping(content) or not sequence(content.get("claims")) or not content["claims"]:
            return Rejected(Code.NATIVE, f"Missing material Claims: {name}")
    return None


def snapshot(
    root: Path, spec: Coverage, files: tuple[str, ...]
) -> dict[str, dict[str, str]] | Rejected:
    areas: dict[str, dict[str, str]] = {}
    all_pages = tuple(
        name
        for name in files
        if name == "README.md" or (name.startswith(("docs/", "openwiki/")) and name.endswith(".md"))
    )
    owned = (
        {page for area in spec.areas for page in area.pages}
        | set(spec.archives)
        | {"docs/index.md", "docs/GLOSSARY.md", "openwiki/INSTRUCTIONS.md"}
    )
    unowned = [
        name
        for name in all_pages
        if name not in owned and Path(name).name not in {"index.md", "log.md"}
    ]
    uncovered = [
        name
        for name in files
        if name.startswith(SOURCE_ROOTS)
        and not any(matches(name, area.sources) for area in spec.areas)
    ]
    if unowned or uncovered:
        return Rejected(Code.COVERAGE, f"Unmapped paths: {', '.join(unowned + uncovered)}")
    for area in spec.areas:
        selected = tuple(name for name in files if matches(name, area.sources))
        for source in area.sources:
            if not any(matches(name, (source,)) for name in selected):
                return Rejected(Code.COVERAGE, f"Empty source selection: {source}")
        areas[area.name] = {name: digest(root, name) for name in sorted({*selected, *area.pages})}
    for rejection in (
        native(root, all_pages),
        examine_links(root, tuple(name for name in all_pages if name not in spec.archives)),
    ):
        if rejection:
            return rejection
    native_records = tuple(
        name
        for name in files
        if name.startswith("openwiki/.claims/")
        or name in {"openwiki/.page-manifest.json", "openwiki/.last-update.json"}
    )
    areas["navigation"] = {
        name: digest(root, name)
        for name in (*all_pages, *native_records)
        if name not in spec.archives
    }
    return areas


def compare(
    previous: object, state: Mapping[str, object], current: dict[str, dict[str, str]]
) -> tuple[int, dict[str, object]]:
    if not mapping(previous) or not mapping(old_areas := previous.get("areas")):
        return 2, {"type": "REJECTED", "code": Code.INPUT, "detail": "Invalid knowledge lock"}
    affected: dict[str, list[str]] = {}
    for area in sorted(set(current) | set(old_areas)):
        old = old_areas.get(area, {})
        if not mapping(old):
            return 2, {"type": "REJECTED", "code": Code.INPUT, "detail": "Invalid locked area"}
        now = current.get(area, {})
        changes = [name for name in sorted(set(old) | set(now)) if old.get(name) != now.get(name)]
        if changes:
            affected[area] = changes
    return 1, {
        "type": "STALE",
        "detail": "Review affected explanations and run record",
        "affected": affected,
        "coverageChanged": previous.get("coverageSha256") != state["coverageSha256"],
    }


def run(root: Path, command: str) -> tuple[int, dict[str, object]]:
    try:
        spec = coverage(load(root / CONFIG))
        if isinstance(spec, Rejected):
            return 2, {"type": "REJECTED", "code": spec.code, "detail": spec.detail}
        current = snapshot(root, spec, inventory(root))
        if isinstance(current, Rejected):
            return 2, {"type": "REJECTED", "code": current.code, "detail": current.detail}
        state = {"schemaVersion": 1, "coverageSha256": digest(root, CONFIG), "areas": current}
        if command == "record":
            _ = (root / LOCK).write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")
            return 0, {
                "type": "RECORDED",
                "areas": sorted(current),
                "limit": "Records reviewed bytes, not semantic correctness",
            }
        previous = load(root / LOCK)
        if previous == state:
            return 0, {"type": "CURRENT", "areas": sorted(current)}
        return compare(previous, state, current)
    except (OSError, ValueError, yaml.YAMLError, subprocess.CalledProcessError) as exc:
        return 2, {"type": "REJECTED", "code": Code.INPUT, "detail": str(exc)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("command", choices=["check", "record"])
    _ = parser.add_argument("--repo", type=Path, default=Path.cwd())
    args = parser.parse_args()
    code, report = run(args.repo.resolve(), args.command)
    print(json.dumps(report))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
