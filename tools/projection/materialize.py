"""Apply the typed Pkl plan to immutable source bytes."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pathlib import Path
    from typing import TypeGuard


class InvalidPlan(Enum):
    STRUCTURE = "unexpected projection shape"
    PATH = "unsafe relative path"
    REFERENCE = "reference differs from the source graph"
    CONFLICT = "conflicting output files"
    MISSING = "missing output or source file"
    SEAL = "projection changed during sealing"


def record(value: object, *fields: str) -> dict[str, object]:
    # JSON objects always have string keys.
    def mapping(raw: object) -> TypeGuard[dict[str, object]]:
        return isinstance(raw, dict)

    if not mapping(value) or (fields and set(value) != set(fields)):
        raise ValueError(InvalidPlan.STRUCTURE)
    return value


def sequence(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def records(value: object) -> list[dict[str, object]]:
    if not sequence(value):
        raise ValueError(InvalidPlan.STRUCTURE)
    return [record(item) for item in value]


def string(value: object) -> str:
    if not isinstance(value, str):
        raise TypeError(InvalidPlan.STRUCTURE)
    return value


def relative(value: object) -> str:
    path = string(value)
    if "\\" in path or "\0" in path or any(part in {"", ".", ".."} for part in path.split("/")):
        raise ValueError(InvalidPlan.PATH)
    return path


def encode(value: object) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n"
    ).encode()


@dataclass(frozen=True)
class File:
    data: bytes
    mode: int

    def write(self, target: Path) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as stream:
            _ = stream.write(self.data)
        target.chmod(self.mode)


def digest(files: dict[str, File], path: str, algorithm: str = "sha256") -> str:
    hash_value = hashlib.new(algorithm, usedforsecurity=False)
    if path in files:
        hash_value.update(files[path].data)
    else:
        children = sorted(key for key in files if key.startswith(path + "/"))
        if not children:
            raise ValueError(InvalidPlan.MISSING)
        for key in children:
            hash_value.update(key[len(path) + 1 :].encode() + b"\0")
            hash_value.update(files[key].data + b"\0")
    return ("sha256:" if algorithm == "sha256" else "") + hash_value.hexdigest()


@dataclass
class Payload:
    files: dict[str, File] = field(default_factory=dict[str, File])
    digests: dict[str, str] = field(default_factory=dict[str, str])
    claims: dict[str, str] = field(default_factory=dict[str, str])

    def add(self, key: str, file: File) -> None:
        if self.files.setdefault(key, file) != file:
            raise ValueError(InvalidPlan.CONFLICT)

    def render(self, key: str, output: dict[str, object]) -> None:
        _ = record(output, "path", "text", "format")
        text = string(output["text"])
        if output["format"] == "TEXT":
            data = text.encode()
        elif output["format"] == "JSON":
            data = encode(json.loads(text))
        else:
            raise ValueError(InvalidPlan.STRUCTURE)
        self.add(key, File(data, 0o644))

    def copy(self, frozen: dict[str, File], operation: dict[str, object], root: str) -> None:
        _ = record(operation, "source", "target")
        source, target = relative(operation["source"]), root + "/" + relative(operation["target"])
        if not source.startswith("source/"):
            raise ValueError(InvalidPlan.PATH)
        if source in frozen:
            self.add(target, frozen[source])
            return
        children = [key for key in frozen if key.startswith(source + "/")]
        if not children:
            raise ValueError(InvalidPlan.MISSING)
        for key in children:
            self.add(target + key[len(source) :], frozen[key])

    def reference(
        self, ref: dict[str, object], plugin: str, root: str, authority: dict[str, str]
    ) -> None:
        name = "/" + string(ref["name"]) if "name" in ref else ""
        fields = {"type", "sourcePath", "targetPath", "sha256"}
        _ = record(ref, *(fields | {"name"} if name else fields))
        kind = string(ref["type"])
        identity = kind + name
        source, target = relative(ref["sourcePath"]), relative(ref["targetPath"])
        claimed = string(ref["sha256"])
        if authority.pop(identity, None) != source or not re.fullmatch(
            "sha256:[0-9a-f]{64}", claimed
        ):
            raise ValueError(InvalidPlan.REFERENCE)
        if kind == "RESOURCE" and target != source.removeprefix("source/"):
            raise ValueError(InvalidPlan.REFERENCE)
        key = plugin + ":" + identity
        self.digests[key] = digest(self.files, root + "/" + target)
        self.claims[key] = claimed

    def inventory(self, tree: str) -> None:
        entries = {key.removeprefix(tree + "/"): digest(self.files, key) for key in self.files}
        data = encode({"type": "PI_PLUGIN_PACKAGE", "schemaVersion": 1, "files": entries})
        self.add(tree + "/native-inventory.json", File(data, 0o644))


TREES = {
    "codex": ".agents/plugins",
    "github-copilot": ".github/plugin",
    "amp": ".amp/plugins",
    "pi": ".pi/slopsentral",
    "claude": "plugins",
}


@dataclass(frozen=True)
class Layout:
    harness: str
    tree: str

    @property
    def catalog(self) -> str:
        return ".claude-plugin" if self.harness == "claude" else self.tree

    def plugin(
        self,
        payload: Payload,
        plan: dict[str, object],
        source: dict[str, object],
        frozen: dict[str, File],
    ) -> None:
        _ = record(plan, "name", "root", "copies", "files", "references")
        name = string(plan["name"])
        root = self.tree + "/" + name
        if plan["root"] != root or not re.fullmatch("[a-z][a-z0-9-]*", name):
            raise ValueError(InvalidPlan.STRUCTURE)
        for copy in records(plan["copies"]):
            payload.copy(frozen, copy, root)
        for output in records(plan["files"]):
            payload.render(root + "/" + relative(output["path"]), output)
        expected = {
            string(r["type"]) + "/" + string(r["name"]): relative(r["sourcePath"])
            for r in records(source["references"])
        }
        if self.harness != "github-copilot" and "mcp" in source:
            expected["MCP_CONFIGURATION"] = relative(source["mcp"])
        for ref in records(plan["references"]):
            if ref.get("type") == "RESOURCE" and relative(ref["sourcePath"]) not in frozen:
                raise ValueError(InvalidPlan.REFERENCE)
            payload.reference(ref, name, root, expected)
        required = {
            "amp": ("index.js", "package.json", "capabilities.json"),
            "claude": (".claude-plugin/plugin.json",),
        }.get(self.harness, ())
        if expected or any(root + "/" + file not in payload.files for file in required):
            raise ValueError(InvalidPlan.MISSING)

    def materialize(
        self, raw: object, source: dict[str, object], frozen: dict[str, File]
    ) -> Payload:
        plan = record(raw, "type", "schemaVersion", "harness", "plugins", "files")
        if (
            plan["type"] != "PROJECTION_PLAN"
            or type(plan["schemaVersion"]) is not int
            or plan["schemaVersion"] != 1
            or plan["harness"] != self.harness
        ):
            raise ValueError(InvalidPlan.STRUCTURE)
        remaining = {string(p["name"]): p for p in records(source["plugins"])}
        payload = Payload()
        for item in records(plan["plugins"]):
            self.plugin(payload, item, remaining.pop(string(item["name"])), frozen)
        for output in records(plan["files"]):
            path = relative(output["path"])
            if not path.startswith(self.catalog + "/"):
                raise ValueError(InvalidPlan.PATH)
            payload.render(path, output)
        if remaining or self.catalog + "/marketplace.json" not in payload.files:
            raise ValueError(InvalidPlan.MISSING)
        return payload
