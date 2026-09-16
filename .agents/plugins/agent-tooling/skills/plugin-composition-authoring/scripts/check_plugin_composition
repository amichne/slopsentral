#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


PRIMITIVE_FIELDS = {
    "skills": "SKILL",
    "agents": "AGENT",
    "hooks": "HOOK",
    "instructions": "INSTRUCTION",
}
PAYLOAD_DIR_NAMES = {
    "agents",
    "concepts",
    "evals",
    "hooks",
    "instructions",
    "profiles",
    "schemas",
    "skills",
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check a referential source plugin composition.")
    parser.add_argument("--repo", default=".", help="Repository root.")
    parser.add_argument("--plugin", required=True, help="Plugin name under source/plugins.")
    args = parser.parse_args(argv)

    repo = Path(args.repo).resolve()
    findings: list[str] = []
    result = check_plugin(repo, args.plugin, findings)
    output = {
        "ok": not findings,
        "plugin": args.plugin,
        "summary": result,
        "findings": findings,
    }
    print(json.dumps(output, indent=2, sort_keys=True))
    return 0 if not findings else 1


def check_plugin(repo: Path, plugin_name: str, findings: list[str]) -> dict[str, Any]:
    plugin_dir = repo / "source" / "plugins" / plugin_name
    manifest_path = plugin_dir / "plugin.json"
    marketplace_path = repo / "source" / "adaptable.marketplace.json"
    manifest = read_json(manifest_path, findings)
    marketplace = read_json(marketplace_path, findings)
    counts: dict[str, int] = {field: 0 for field in PRIMITIVE_FIELDS}

    if manifest is None or marketplace is None:
        return counts

    if manifest.get("type") != "PLUGIN":
        findings.append("plugin manifest type must be PLUGIN")
    if manifest.get("name") != plugin_name:
        findings.append(f"plugin manifest name {manifest.get('name')!r} must match {plugin_name!r}")
    if manifest.get("metadata", {}).get("composition") != "referential":
        findings.append("metadata.composition must be referential")

    for child in sorted(plugin_dir.iterdir()) if plugin_dir.exists() else []:
        if child.is_dir() and child.name in PAYLOAD_DIR_NAMES:
            findings.append(f"plugin directory must not contain primitive payload directory: {child.relative_to(repo)}")

    for field, expected_type in PRIMITIVE_FIELDS.items():
        refs = manifest.get(field, [])
        if not isinstance(refs, list):
            findings.append(f"{field} must be an array")
            continue
        counts[field] = len(refs)
        seen: set[str] = set()
        for index, ref in enumerate(refs):
            owner = f"{field}[{index}]"
            validate_ref(repo, owner, ref, expected_type, findings)
            name = ref.get("name") if isinstance(ref, dict) else None
            if isinstance(name, str):
                if name in seen:
                    findings.append(f"{owner}: duplicate reference name {name}")
                seen.add(name)

    validate_marketplace_entry(plugin_name, manifest, marketplace, findings)
    validate_standalone_skills(manifest, marketplace, findings)
    return counts


def validate_ref(repo: Path, owner: str, ref: Any, expected_type: str, findings: list[str]) -> None:
    if not isinstance(ref, dict):
        findings.append(f"{owner}: reference must be an object")
        return
    if ref.get("type") != expected_type:
        findings.append(f"{owner}: type must be {expected_type}")
    if ref.get("source", {}).get("type") != "LOCAL_SOURCE" or ref.get("source", {}).get("path") != "./":
        findings.append(f"{owner}: source must be LOCAL_SOURCE ./")
    path_value = ref.get("path")
    name = ref.get("name")
    if not isinstance(path_value, str) or not path_value:
        findings.append(f"{owner}: path is required")
        return
    if not isinstance(name, str) or not name:
        findings.append(f"{owner}: name is required")
    if path_value.startswith("/") or ".." in Path(path_value).parts:
        findings.append(f"{owner}: path must be source-relative and must not traverse upward")
        return
    absolute_path = repo / "source" / path_value
    if not absolute_path.exists():
        findings.append(f"{owner}: path does not exist: source/{path_value}")
        return

    if expected_type == "SKILL":
        frontmatter = read_frontmatter(absolute_path / "SKILL.md", findings)
        if frontmatter.get("name") != name:
            findings.append(f"{owner}: SKILL.md frontmatter name must match {name}")
    elif expected_type == "HOOK":
        hook = read_json(absolute_path, findings)
        if hook and hook.get("name") != name:
            findings.append(f"{owner}: hook manifest name must match {name}")
    elif expected_type == "AGENT":
        frontmatter = read_frontmatter(absolute_path, findings)
        if frontmatter.get("name") != name:
            findings.append(f"{owner}: agent frontmatter name must match {name}")
    elif expected_type == "INSTRUCTION" and not absolute_path.is_file():
        findings.append(f"{owner}: instruction reference must point at a file")


def validate_marketplace_entry(
    plugin_name: str,
    manifest: dict[str, Any],
    marketplace: dict[str, Any],
    findings: list[str],
) -> None:
    entries = [entry for entry in marketplace.get("plugins", []) if entry.get("name") == plugin_name]
    if len(entries) != 1:
        findings.append(f"marketplace must contain exactly one plugin entry for {plugin_name}")
        return
    entry = entries[0]
    plugin_ref = entry.get("plugin", {})
    if plugin_ref.get("name") != plugin_name:
        findings.append(f"marketplace plugin reference name must be {plugin_name}")
    if plugin_ref.get("source", {}).get("path") != f"./plugins/{plugin_name}":
        findings.append(f"marketplace plugin source path must be ./plugins/{plugin_name}")
    if plugin_ref.get("version") != manifest.get("version"):
        findings.append("marketplace plugin version must match plugin manifest version")
    if entry.get("description") != manifest.get("description"):
        findings.append("marketplace plugin description should match plugin manifest description")


def validate_standalone_skills(
    manifest: dict[str, Any],
    marketplace: dict[str, Any],
    findings: list[str],
) -> None:
    standalone_skills = {entry.get("name") for entry in marketplace.get("skills", [])}
    for ref in manifest.get("skills", []):
        name = ref.get("name") if isinstance(ref, dict) else None
        if name not in standalone_skills:
            findings.append(f"composed skill must also be marketplace-visible as a standalone primitive: {name}")


def read_json(path: Path, findings: list[str]) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        findings.append(f"missing JSON file: {path}")
        return None
    except json.JSONDecodeError as error:
        findings.append(f"invalid JSON: {path}: {error}")
        return None
    if not isinstance(payload, dict):
        findings.append(f"JSON root must be an object: {path}")
        return None
    return payload


def read_frontmatter(path: Path, findings: list[str]) -> dict[str, str]:
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        findings.append(f"missing frontmatter file: {path}")
        return {}
    if not text.startswith("---\n"):
        findings.append(f"missing YAML frontmatter: {path}")
        return {}
    end = text.find("\n---", 4)
    if end < 0:
        findings.append(f"unterminated YAML frontmatter: {path}")
        return {}
    fields: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        fields[key.strip()] = value.strip().strip("\"'")
    return fields


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
