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
"""Supply frozen files to Pkl and publish its complete output without replacement."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Literal, TypeGuard

ROOT = Path(__file__).resolve().parents[1]
IGNORED = frozenset(
    {
        ".git",
        ".gradle",
        ".idea",
        "__pycache__",
        ".ruff_cache",
        ".pytest_cache",
        "build",
        "dist",
        "target",
    }
)


class Code(StrEnum):
    UNSAFE_PATH = "UNSAFE_PATH"
    SOURCE_REJECTED = "SOURCE_REJECTED"
    INPUT_CHANGED = "INPUT_CHANGED"
    PKL_UNAVAILABLE = "PKL_UNAVAILABLE"
    PKL_REJECTED = "PKL_REJECTED"
    INVALID_PLAN = "INVALID_PLAN"
    OUTPUT_EXISTS = "OUTPUT_EXISTS"
    WRITE_FAILED = "WRITE_FAILED"
    ATOMIC_PUBLISH_UNAVAILABLE = "ATOMIC_PUBLISH_UNAVAILABLE"


class ProjectionError(Exception):
    """Stop an outer operation after a finite adapter failure."""

    def __init__(self, code: Code, message: str) -> None:
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class File:
    data: bytes
    mode: int


type Models = tuple[tuple[str, bytes], ...]


def models_snapshot() -> Models:
    return tuple(
        (file.name, file.read_bytes()) for file in sorted((ROOT / "tools/projection").glob("*.pkl"))
    )


def mapping(value: object) -> TypeGuard[dict[str, object]]:
    return isinstance(value, dict)


def sequence(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def obj(value: object) -> dict[str, object]:
    if not mapping(value):
        raise ProjectionError(Code.INVALID_PLAN, "Expected an object")
    return value


def array(value: object) -> list[object]:
    if not sequence(value):
        raise ProjectionError(Code.INVALID_PLAN, "Expected a list")
    return value


def string(value: object) -> str:
    if not isinstance(value, str):
        raise ProjectionError(Code.INVALID_PLAN, "Expected text")
    return value


def path(value: object) -> str:
    text = string(value)
    if not text or text.startswith("/") or "\\" in text or ":" in text:
        raise ProjectionError(Code.UNSAFE_PATH, "Expected a relative resource path")
    if set(text.split("/")) & {"", ".", ".."}:
        raise ProjectionError(Code.UNSAFE_PATH, "Expected a canonical resource path")
    return text


def decode(text: str) -> dict[str, object]:
    value: object = json.loads(text)
    return obj(value)


def encode(value: object) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode()


def snapshot(repository: Path) -> dict[str, File]:
    files: dict[str, File] = {}
    source = repository / "source"
    if source.is_symlink() or not source.is_dir():
        raise ProjectionError(Code.UNSAFE_PATH, "Expected a direct source directory")
    for directory, directories, names in os.walk(source, followlinks=False):
        folder = Path(directory)
        for name in [*directories, *names]:
            if (folder / name).is_symlink():
                raise ProjectionError(Code.UNSAFE_PATH, "Source contains a symbolic link")
        directories[:] = sorted(name for name in directories if name not in IGNORED)
        for name in sorted(names):
            item = folder / name
            if name.endswith(".pyc"):
                continue
            mode = item.stat().st_mode
            if not stat.S_ISREG(mode):
                raise ProjectionError(Code.UNSAFE_PATH, "Source contains a non-regular file")
            files[item.relative_to(repository).as_posix()] = File(
                item.read_bytes(), stat.S_IMODE(mode)
            )
    return dict(sorted(files.items()))


def digest(files: dict[str, File], prefix: str, algorithm: str = "sha256") -> str:
    value = hashlib.new(algorithm)
    if prefix in files:
        value.update(files[prefix].data)
    else:
        children = sorted(key for key in files if key.startswith(prefix + "/"))
        if not children:
            raise ProjectionError(Code.SOURCE_REJECTED, "A referenced payload is absent")
        for key in children:
            value.update(key[len(prefix) + 1 :].encode())
            value.update(b"\0")
            value.update(files[key].data)
            value.update(b"\0")
    return ("sha256:" if algorithm == "sha256" else "") + value.hexdigest()


def run(arguments: list[str], cwd: Path) -> str:
    result = subprocess.run(
        arguments, cwd=cwd, capture_output=True, text=True, timeout=65, check=False
    )
    if result.returncode:
        location = re.search(r"/([A-Za-z]+\.pkl), line ([0-9]+)\)", result.stderr)
        message = "The evaluator rejected the input"
        if location:
            message += f" at {location[1]}:{location[2]}"
        raise ProjectionError(Code.PKL_REJECTED, message)
    return result.stdout


def evaluate(
    pkl: str,
    module: Literal["Source.pkl", "Project.pkl", "Catalog.pkl"],
    value: object,
    harness: str = "codex",
    *,
    models: Models | None = None,
) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix="slopsentral-pkl-") as temporary:
        workspace = Path(temporary)
        for name, data in models if models is not None else models_snapshot():
            _ = (workspace / name).write_bytes(data)
        payload = workspace / "input.json"
        _ = payload.write_bytes(encode(value))
        uri = payload.as_uri()
        property_name = "input" if module == "Project.pkl" else "snapshot"
        return decode(
            run(
                [
                    pkl,
                    "eval",
                    "--no-project",
                    "--no-cache",
                    "--root-dir",
                    str(workspace),
                    "--allowed-modules",
                    "^pkl:,^file:",
                    "--allowed-resources",
                    "^prop:(input|snapshot|harness)$,^" + re.escape(uri) + "$",
                    "--timeout",
                    "60",
                    "--color",
                    "never",
                    "-p",
                    f"{property_name}={uri}",
                    "-p",
                    f"harness={harness}",
                    module,
                ],
                workspace,
            )
        )


def prepare_pkl(pkl: str, repository: Path) -> None:
    try:
        version = run([pkl, "--version"], repository)
    except (OSError, subprocess.TimeoutExpired, ProjectionError) as error:
        raise ProjectionError(Code.PKL_UNAVAILABLE, "The Pkl executable is unavailable") from error
    if not version.startswith("Pkl 0.32.0"):
        raise ProjectionError(Code.PKL_UNAVAILABLE, "Pkl 0.32.0 is necessary")


def snapshot_payload(repository: Path, files: dict[str, File], pkl: str) -> dict[str, object]:
    prepare_pkl(pkl, repository)
    prefixes = {key.rsplit("/", 1)[0] for key in files}
    for prefix in tuple(prefixes):
        prefixes.update(
            parent.as_posix() for parent in Path(prefix).parents if parent.as_posix() != "."
        )
    return {
        "files": {key: {"text": file.data.decode("utf-8")} for key, file in files.items()},
        "digests": {key: digest(files, key) for key in sorted(set(files) | prefixes)},
        "sourceSha": digest(files, "source", "sha1"),
        "generatedAt": run(["git", "show", "-s", "--format=%cI", "HEAD"], repository).strip(),
    }


def source_input(
    repository: Path, files: dict[str, File], pkl: str, models: Models | None = None
) -> dict[str, object]:
    raw = snapshot_payload(repository, files, pkl)
    result = evaluate(pkl, "Source.pkl", raw, models=models)
    if not {"name", "owner", "sourceSha", "plugins", "profiles"}.issubset(result):
        raise ProjectionError(Code.INVALID_PLAN, "Pkl omitted the typed source input")
    return result


def append_file(output: dict[str, File], tree: str, destination: str, file: File) -> None:
    destination = path(destination)
    if not destination.startswith(tree + "/"):
        raise ProjectionError(Code.UNSAFE_PATH, "Output escaped the provider tree")
    if destination in output and output[destination] != file:
        raise ProjectionError(Code.INVALID_PLAN, "Conflicting output files")
    output[destination] = file


def copy_files(
    output: dict[str, File], tree: str, files: dict[str, File], raw: object, prefix: str
) -> None:
    operation = obj(raw)
    source = path(operation.get("source"))
    target = prefix + path(operation.get("target"))
    if not source.startswith("source/"):
        raise ProjectionError(Code.UNSAFE_PATH, "Copy escaped authored source")
    if source in files:
        append_file(output, tree, target, files[source])
        return
    children = [key for key in files if key.startswith(source + "/")]
    if not children:
        raise ProjectionError(Code.INVALID_PLAN, "Copy has no frozen payload")
    for key in children:
        append_file(output, tree, target + "/" + key[len(source) + 1 :], files[key])


def write_file(output: dict[str, File], tree: str, raw: object, prefix: str) -> None:
    operation = obj(raw)
    data = string(operation.get("text")).encode()
    match operation.get("format"):
        case "JSON":
            data = encode(json.loads(data))
        case "TEXT":
            pass
        case _:
            raise ProjectionError(Code.INVALID_PLAN, "Unsupported output format")
    append_file(output, tree, prefix + path(operation.get("path")), File(data, 0o644))


def operations(plan: dict[str, object], files: dict[str, File], harness: str) -> dict[str, File]:
    tree = {
        "codex": ".agents/plugins",
        "github-copilot": ".github/plugin",
        "pi": ".pi/slopsentral",
    }[harness]
    if plan.get("type") != "PROJECTION_PLAN" or plan.get("harness") != harness:
        raise ProjectionError(Code.INVALID_PLAN, "Expected the selected provider plan")
    output: dict[str, File] = {}

    for raw in array(plan.get("plugins")):
        plugin = obj(raw)
        prefix = path(plugin.get("root")) + "/"
        for operation in array(plugin.get("copies")):
            copy_files(output, tree, files, operation, prefix)
        for operation in array(plugin.get("files")):
            write_file(output, tree, operation, prefix)
    for operation in array(plan.get("copies", [])):
        copy_files(output, tree, files, operation, tree + "/")
    for operation in array(plan.get("files")):
        write_file(output, tree, operation, "")
    if tree + "/marketplace.json" not in output:
        raise ProjectionError(Code.INVALID_PLAN, "The plan omitted its marketplace")
    return output


def projected_digests(plan: dict[str, object], files: dict[str, File]) -> dict[str, str]:
    result: dict[str, str] = {}
    for raw in array(plan.get("plugins")):
        plugin = obj(raw)
        for raw_reference in array(plugin.get("references")):
            ref = obj(raw_reference)
            name = ref.get("name")
            identity = string(plugin.get("name")) + ":" + string(ref.get("type"))
            if name is not None:
                identity += "/" + string(name)
            result[identity] = digest(
                files, path(plugin.get("root")) + "/" + path(ref.get("targetPath"))
            )
    return result


def examine_plan(plan: dict[str, object], source: dict[str, object]) -> None:
    expected = {string(obj(raw).get("name")): obj(raw) for raw in array(source.get("plugins"))}
    actual = [obj(raw) for raw in array(plan.get("plugins"))]
    names = [string(plugin.get("name")) for plugin in actual]
    if len(set(names)) != len(names):
        raise ProjectionError(Code.INVALID_PLAN, "The plan repeated a plugin")
    if set(names) != set(expected):
        raise ProjectionError(Code.INVALID_PLAN, "The plan omitted or invented a plugin")
    for plugin in actual:
        original = expected[string(plugin.get("name"))]
        expected_refs = {
            (obj(ref).get("type"), obj(ref).get("name"))
            for ref in array(original.get("references"))
        }
        if original.get("mcp") is not None and plan.get("harness") != "github-copilot":
            expected_refs.add(("MCP_CONFIGURATION", None))
        refs = [
            (obj(ref).get("type"), obj(ref).get("name")) for ref in array(plugin.get("references"))
        ]
        if len(refs) != len(set(refs)) or set(refs) != expected_refs:
            raise ProjectionError(
                Code.INVALID_PLAN, "The plan omitted or invented a source reference"
            )


def examine_seal(plan: dict[str, object], files: dict[str, File], harness: str) -> None:
    if harness != "github-copilot":
        prefix = ".pi/slopsentral" if harness == "pi" else ".agents/plugins"
        if prefix + "/marketplace-lock.json" not in files:
            raise ProjectionError(Code.INVALID_PLAN, "The plan omitted sealed provenance")
    digests = projected_digests(plan, files)
    for raw in array(plan.get("plugins")):
        plugin = obj(raw)
        for raw_ref in array(plugin.get("references")):
            ref = obj(raw_ref)
            key = string(plugin.get("name")) + ":" + string(ref.get("type"))
            if ref.get("name") is not None:
                key += "/" + string(ref.get("name"))
            if ref.get("sha256") != digests[key]:
                raise ProjectionError(Code.INVALID_PLAN, "A sealed digest differs from its payload")


def project(repository: Path, harness: str, target: Path, pkl: str) -> dict[str, object]:
    if target.is_relative_to(repository):
        raise ProjectionError(Code.UNSAFE_PATH, "Output must be outside the source repository")
    if target.exists() or target.is_symlink():
        raise ProjectionError(Code.OUTPUT_EXISTS, "Output already exists")
    files = snapshot(repository)
    models = models_snapshot()
    input_value = source_input(repository, files, pkl, models)
    first = evaluate(pkl, "Project.pkl", input_value, harness, models=models)
    examine_plan(first, input_value)
    initial = operations(first, files, harness)
    input_value.update(phase="SEALED", projectedDigests=projected_digests(first, initial))
    sealed = evaluate(pkl, "Project.pkl", input_value, harness, models=models)
    examine_plan(sealed, input_value)
    complete = operations(sealed, files, harness)
    examine_seal(sealed, complete, harness)
    if not all(complete.get(key) == value for key, value in initial.items()):
        raise ProjectionError(Code.INVALID_PLAN, "Sealing changed a derived payload")
    if projected_digests(sealed, complete) != projected_digests(first, initial):
        raise ProjectionError(Code.INVALID_PLAN, "Sealing changed a payload digest")
    if snapshot(repository) != files:
        raise ProjectionError(Code.INPUT_CHANGED, "Source changed during projection")
    with tempfile.TemporaryDirectory(
        prefix=".slopsentral-projection-", dir=target.parent
    ) as temporary:
        staging = Path(temporary)
        for key, file in complete.items():
            destination = staging / key
            destination.parent.mkdir(parents=True, exist_ok=True)
            _ = destination.write_bytes(file.data)
            destination.chmod(file.mode)
        if snapshot(repository) != files:
            raise ProjectionError(Code.INPUT_CHANGED, "Source changed before publication")
        receipt = decode(
            run(
                [
                    sys.executable,
                    str(ROOT / "tools/projection/publish_directory.py"),
                    str(staging),
                    str(target),
                ],
                repository,
            )
        )
        if receipt.get("type") != "PUBLISHED":
            raise ProjectionError(
                Code(string(receipt.get("reason"))), "Atomic publication rejected the target"
            )
        # TemporaryDirectory owns cleanup, including after the sibling rename.
    return {
        "type": "PROJECTED",
        "harness": harness,
        "engine": "Pkl 0.32.0",
        "plugins": len(array(sealed.get("plugins"))),
        "files": len(complete),
        "sourceSha": input_value["sourceSha"],
        "out": str(target),
    }


def compare_catalog(target: Path, expected: str) -> None:
    if target.read_text() != expected:
        raise ProjectionError(Code.SOURCE_REJECTED, "The generated catalog is stale")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("command", choices=("validate", "project", "catalog"))
    _ = parser.add_argument("--source", type=Path, default=ROOT)
    _ = parser.add_argument("--harness", choices=("codex", "github-copilot", "pi"), default="codex")
    _ = parser.add_argument("--out", type=Path)
    _ = parser.add_argument("--check", action="store_true")
    _ = parser.add_argument("--pkl-bin", default=os.environ.get("PKL_BIN", "pkl"))
    args = parser.parse_args()
    repository = Path(args.source).resolve()
    try:
        if args.command == "validate":
            value = source_input(repository, snapshot(repository), str(args.pkl_bin))
            result: dict[str, object] = {
                "type": "SOURCE_VALID",
                "engine": "Pkl 0.32.0",
                "plugins": len(array(value.get("plugins"))),
            }
        elif args.command == "catalog":
            payload = snapshot_payload(repository, snapshot(repository), str(args.pkl_bin))
            catalog = string(evaluate(str(args.pkl_bin), "Catalog.pkl", payload).get("text"))
            target = Path(args.out) if args.out is not None else repository / "source/CATALOG.md"
            if args.check:
                compare_catalog(target, catalog)
            else:
                _ = target.write_text(catalog)
            result = {
                "type": "CATALOG_CHECKED" if args.check else "CATALOG_WRITTEN",
                "out": str(target),
            }
        else:
            if args.out is None:
                parser.error("project needs --out")
            result = project(
                repository, str(args.harness), Path(args.out).absolute(), str(args.pkl_bin)
            )
        print(json.dumps(result))
    except ProjectionError as error:
        print(
            json.dumps(
                {"type": "PROJECTION_REJECTED", "code": error.code.value, "message": str(error)}
            ),
            file=sys.stderr,
        )
        return 1
    except (OSError, UnicodeError, ValueError, subprocess.TimeoutExpired) as error:
        print(
            json.dumps(
                {
                    "type": "PROJECTION_REJECTED",
                    "code": Code.WRITE_FAILED.value,
                    "message": str(error),
                }
            ),
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
