"""Project a frozen source graph through Pkl and publish its sealed files."""

from __future__ import annotations

import json
import os
import re
import stat
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from projection.materialize import (
    TREES,
    File,
    InvalidPlan,
    Layout,
    Payload,
    digest,
    encode,
    record,
    records,
    relative,
    sequence,
    string,
)
from projection.publish_directory import publish

MODELS = Path(__file__).resolve().parent / "projection"
IGNORED = {
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
UNSUPPORTED_GRAPH = 2
MAX_OUTPUT = 32 * 1024 * 1024
USAGE = (
    "Use --source <repo> --harness " + "|".join(TREES) + " --out <new-directory> [--pkl-bin <path>]"
)


class Failure(Enum):
    INVALID_INVOCATION = "invocation", "INVALID_INVOCATION"
    UNSAFE_PATH = "paths", "UNSAFE_PATH"
    SOURCE_REJECTED = "source", "SOURCE_REJECTED"
    UNSUPPORTED_SOURCE = "source", "UNSUPPORTED_SOURCE"
    INPUT_CHANGED = "source", "INPUT_CHANGED"
    PKL_UNAVAILABLE = "evaluate", "PKL_UNAVAILABLE"
    PKL_REJECTED = "evaluate", "PKL_REJECTED"
    INVALID_PLAN = "plan", "INVALID_PLAN"
    SEAL = "seal", "INVALID_PLAN"
    OUTPUT_EXISTS = "publish", "OUTPUT_EXISTS"
    ATOMIC_PUBLISH_UNAVAILABLE = "publish", "ATOMIC_PUBLISH_UNAVAILABLE"
    WRITE_FAILED = "publish", "WRITE_FAILED"


@dataclass
class ProjectionError(Exception):
    failure: Failure
    message: str
    diagnostic: dict[str, object] | None = None

    def outcome(self) -> dict[str, object]:
        stage, code = self.failure.value
        result: dict[str, object] = {
            "type": "PROJECTION_REJECTED",
            "stage": stage,
            "code": code,
            "message": self.message,
        }
        if self.diagnostic:
            result["diagnostic"] = self.diagnostic
        return result


def directory(path: Path) -> Path:
    if path.is_symlink() or not path.is_dir():
        raise ProjectionError(Failure.UNSAFE_PATH, "A required directory is missing or indirect")
    return path.resolve()


def read_file(path: Path) -> File:
    mode = path.stat().st_mode
    if not stat.S_ISREG(mode):
        raise ProjectionError(Failure.UNSAFE_PATH, "Source contains a non-regular resource")
    return File(path.read_bytes(), mode & 0o777)


def snapshot(repository: Path) -> dict[str, File]:
    source = directory(repository / "source")
    files: dict[str, File] = {}

    def walk(folder: Path) -> None:
        for child in folder.iterdir():
            if child.is_symlink():
                raise ProjectionError(Failure.UNSAFE_PATH, "Source contains a symbolic link")
            if child.is_dir():
                if child.name not in IGNORED:
                    walk(child)
            elif not (child.is_file() and child.suffix == ".pyc"):
                files[child.relative_to(repository).as_posix()] = read_file(child)

    walk(source)
    return files


def graph(operation: str, frozen: Path, repository: Path) -> object:
    result = subprocess.run(
        ["node", str(MODELS / "source-graph.mjs"), operation, str(frozen), str(repository)],
        capture_output=True,
        check=False,
        timeout=60,
    )
    if result.returncode == UNSUPPORTED_GRAPH:
        raise ProjectionError(
            Failure.UNSUPPORTED_SOURCE, "Only repository-local source and assets are supported"
        )
    if result.returncode or len(result.stdout) > MAX_OUTPUT:
        raise ProjectionError(
            Failure.SOURCE_REJECTED, "The authored source did not pass validation"
        )
    return json.loads(result.stdout)


def evidence_at(repository: Path, names: tuple[str, ...]) -> dict[str, File]:
    result: dict[str, File] = {}
    for name in names:
        path = (repository / name).resolve(strict=True)
        if not path.is_relative_to(repository):
            raise ProjectionError(
                Failure.SOURCE_REJECTED, "Current evidence escaped the repository"
            )
        result[name] = read_file(path)
    return result


def hook_files(ref: dict[str, object], files: dict[str, File]) -> list[str]:
    events = record(record(record(ref["hook"])["adapter"])["hooks"])
    paths: set[str] = set()
    for groups in events.values():
        for group in records(groups):
            for command in records(group["hooks"]):
                for name in re.findall(r"\bhooks/[A-Za-z0-9_.-]+", string(command["command"])):
                    paths.add(name)
                    if "source/" + name + ".lock" in files:
                        paths.add(name + ".lock")
                    prefix = "source/" + name.rpartition(".")[0] + "."
                    paths.update(
                        key.removeprefix("source/")
                        for key in files
                        if key.startswith(prefix)
                        and key.endswith(".json")
                        and not key.endswith(".hook.json")
                    )
    return sorted(paths)


@dataclass(frozen=True)
class Frozen:
    files: dict[str, File]
    evidence: dict[str, File]
    model: dict[str, object]

    def confirm(self, repository: Path) -> None:
        try:
            if (
                snapshot(repository) == self.files
                and evidence_at(repository, tuple(self.evidence)) == self.evidence
            ):
                return
        except (OSError, RuntimeError, ProjectionError):
            pass
        raise ProjectionError(
            Failure.INPUT_CHANGED, "Source or current routing evidence changed during projection"
        )


def freeze(repository: Path, frozen: Path) -> Frozen:
    files = snapshot(repository)
    for name, file in files.items():
        file.write(frozen / relative(name))
    paths = graph("evidence", frozen, repository)
    if not sequence(paths):
        raise ValueError(InvalidPlan.STRUCTURE)
    evidence = evidence_at(repository, tuple(relative(path) for path in paths))
    for name, file in evidence.items():
        file.write(frozen / name)
    model = record(graph("graph", frozen, repository))
    mcp: dict[str, str] = {}
    for plugin in records(model["plugins"]):
        for ref in records(plugin["references"]):
            ref["sha256"] = digest(files, relative(ref["sourcePath"]))
            if ref["type"] == "HOOK":
                ref["supportFiles"] = hook_files(ref, files)
        if "mcp" in plugin:
            mcp[string(plugin["name"]) + ":MCP_CONFIGURATION"] = digest(
                files, relative(plugin["mcp"])
            )
    stamp = subprocess.run(
        ["git", "show", "-s", "--format=%cI", "HEAD"],
        cwd=repository,
        capture_output=True,
        check=True,
        text=True,
        timeout=10,
    )
    model.update(
        generatedAt=stamp.stdout.strip(),
        sourceSha=digest(files, "source", "sha1"),
        phase="PLAN",
        projectedDigests=mcp,
    )
    result = Frozen(files, evidence, model)
    result.confirm(repository)
    return result


def pkl_version(pkl: str) -> None:
    try:
        version = subprocess.run([pkl, "--version"], capture_output=True, check=True, timeout=10)
        if re.match(rb"^Pkl 0\.32\.0\b", version.stdout):
            return
    except (OSError, subprocess.SubprocessError):
        pass
    raise ProjectionError(Failure.PKL_UNAVAILABLE, "The projector requires exactly Pkl 0.32.0")


def evaluate(
    pkl: str, models: dict[str, bytes], layout: Layout, model: dict[str, object]
) -> object:
    detail: dict[str, object] = {"type": "EVALUATION_FAILED"}
    with tempfile.TemporaryDirectory(prefix="slopsentral-pkl-") as temporary:
        work = Path(temporary).resolve()
        for name, data in models.items():
            _ = (work / name).write_bytes(data)
        source = work / "input.json"
        _ = source.write_bytes(encode(model))
        uri = source.as_uri()
        command = [
            pkl,
            "eval",
            "--no-project",
            "--no-cache",
            "--root-dir",
            str(work),
            "--allowed-modules",
            "^pkl:,^file:",
            "--allowed-resources",
            "^prop:(input|harness)$,^" + re.escape(uri) + "$",
            "--timeout",
            "60",
            "--color",
            "never",
            "-p",
            "harness=" + layout.harness,
            "-p",
            "input=" + uri,
            str(work / "Project.pkl"),
        ]
        try:
            # Spool untrusted diagnostic and output streams. Only admit bounded bytes into memory.
            with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
                result = subprocess.run(
                    command, cwd=work, stdout=out, stderr=err, check=False, timeout=65
                )
                if not result.returncode and out.tell() <= MAX_OUTPUT:
                    _ = out.seek(0)
                    return json.load(out)
                _ = err.seek(0)
                location = re.search(rb"/([A-Za-z]+\.pkl), line ([0-9]+)\)", err.read(65536))
                if location and location[1].decode() in models:
                    detail = {
                        "type": "MODEL_LOCATION",
                        "module": location[1].decode(),
                        "line": int(location[2]),
                    }
        except (OSError, ValueError, subprocess.TimeoutExpired):
            pass
    raise ProjectionError(
        Failure.PKL_REJECTED, "Pkl could not render a complete projection plan", detail
    )


def seal(pkl: str, layout: Layout, frozen: Frozen) -> Payload:
    pkl_version(pkl)
    models = {path.name: path.read_bytes() for path in MODELS.glob("*.pkl")}

    def derive(model: dict[str, object]) -> Payload:
        raw = evaluate(pkl, models, layout, model)
        try:
            return layout.materialize(raw, model, frozen.files)
        except (KeyError, TypeError, ValueError) as error:
            code = (
                Failure.UNSAFE_PATH if error.args == (InvalidPlan.PATH,) else Failure.INVALID_PLAN
            )
            raise ProjectionError(
                code, "Invalid projection operation, payload, or reference"
            ) from error

    initial = derive(frozen.model)
    complete = derive({**frozen.model, "phase": "SEALED", "projectedDigests": initial.digests})
    if (
        layout.harness != "github-copilot"
        and layout.catalog + "/marketplace-lock.json" not in complete.files
    ):
        raise ProjectionError(Failure.SEAL, "Projection omitted sealed provenance")
    if complete.claims != complete.digests or not initial.files.items() <= complete.files.items():
        raise ProjectionError(Failure.SEAL, "Sealed payload differs from its provenance")
    if layout.harness == "pi":
        complete.inventory(layout.tree)
    return complete


@dataclass(frozen=True)
class Request:
    repository: Path
    layout: Layout
    target: Path
    pkl: str

    @classmethod
    def parse(cls, args: list[str]) -> Request:
        options = {args[i]: args[i + 1] for i in range(0, len(args) - 1, 2)}
        required = {"--source", "--harness", "--out"}
        if (
            len(options) * 2 != len(args)
            or not required <= options.keys() <= required | {"--pkl-bin"}
            or not all(options.values())
            or options["--harness"] not in TREES
        ):
            raise ProjectionError(Failure.INVALID_INVOCATION, USAGE)
        repo = directory(Path(options["--source"]))
        requested = Path(options["--out"]).absolute()
        parent = requested.parent.resolve(strict=True)
        target = parent / requested.name
        if not parent.is_dir() or target.is_relative_to(repo) or repo.is_relative_to(target):
            raise ProjectionError(
                Failure.UNSAFE_PATH, "Projection requires a fresh directory outside the repository"
            )
        if target.exists() or target.is_symlink():
            raise ProjectionError(
                Failure.OUTPUT_EXISTS, "The projection destination already exists"
            )
        harness = options["--harness"]
        return cls(
            repo,
            Layout(harness, TREES[harness]),
            target,
            options.get("--pkl-bin", os.environ.get("PKL_BIN", "pkl")),
        )


def project(request: Request) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix="slopsentral-source-") as workspace:
        try:
            frozen = freeze(request.repository, Path(workspace).resolve())
        except (OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError) as error:
            raise ProjectionError(
                Failure.SOURCE_REJECTED, "The authored source did not pass validation"
            ) from error
        complete = seal(request.pkl, request.layout, frozen)
        frozen.confirm(request.repository)
        with tempfile.TemporaryDirectory(
            dir=request.target.parent, prefix=".slopsentral-projection-"
        ) as staging:
            for name, file in complete.files.items():
                file.write(Path(staging) / name)
            frozen.confirm(request.repository)
            outcome = publish(staging, str(request.target))
            if outcome["type"] != "PUBLISHED":
                raise ProjectionError(
                    Failure[outcome["reason"]], "Could not atomically publish the projection"
                )
    return {
        "type": "PROJECTED",
        "harness": request.layout.harness,
        "engine": "Pkl 0.32.0",
        "plugins": len(records(frozen.model["plugins"])),
        "files": len(complete.files),
        "sourceSha": frozen.model["sourceSha"],
        "out": str(request.target),
    }


def main() -> int:
    try:
        result = project(Request.parse(sys.argv[1:]))
    except ProjectionError as error:
        print(json.dumps(error.outcome()), file=sys.stderr)
        return 1
    except OSError:
        print(
            json.dumps(
                ProjectionError(
                    Failure.WRITE_FAILED, "Projection failed at a filesystem boundary"
                ).outcome()
            ),
            file=sys.stderr,
        )
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
