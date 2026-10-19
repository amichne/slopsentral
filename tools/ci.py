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
"""Explicit CI effects. Native tool identities remain separate from uv packages."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tarfile
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import assert_never

ROOT = Path(__file__).resolve().parents[1]


class Task(StrEnum):
    NATIVE = "native"
    VALIDATE = "validate"
    UNIT = "unit"
    KOTLIN = "kotlin"
    PKL = "pkl"


class SetupFailure(StrEnum):
    DOWNLOAD = "download-unavailable"
    CHECKSUM = "checksum-mismatch"
    ARCHIVE = "archive-rejected"
    FILESYSTEM = "filesystem-unavailable"


@dataclass(frozen=True, slots=True)
class Artifact:
    repository: str
    tag: str
    filename: str
    sha256: str


@dataclass(frozen=True, slots=True)
class Installed:
    directory: Path


def install(artifact: Artifact, target: Path) -> Installed | SetupFailure:
    url = f"https://github.com/{artifact.repository}/releases/download/{artifact.tag}/{artifact.filename}"
    try:
        target.mkdir(parents=True, exist_ok=False)
        archive = target / artifact.filename
        with urllib.request.urlopen(url, timeout=60) as response, archive.open("wb") as output:  # noqa: S310 -- fixed HTTPS GitHub release origin
            shutil.copyfileobj(response, output)
        with archive.open("rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
        if digest != artifact.sha256:
            return SetupFailure.CHECKSUM
        if zipfile.is_zipfile(archive):
            with zipfile.ZipFile(archive) as zipped:
                if any(
                    not (target / name).resolve().is_relative_to(target.resolve())
                    for name in zipped.namelist()
                ):
                    return SetupFailure.ARCHIVE
                zipped.extractall(target)  # noqa: S202 -- pinned digest and all members checked above
        else:
            with tarfile.open(archive) as packed:
                packed.extractall(target, filter="data")
        return Installed(target)
    except urllib.error.URLError:
        return SetupFailure.DOWNLOAD
    except (tarfile.TarError, zipfile.BadZipFile):
        return SetupFailure.ARCHIVE
    except OSError:
        return SetupFailure.FILESYSTEM


def commands(items: tuple[tuple[str, ...], ...], *, env: dict[str, str] | None = None) -> int:
    for command in items:
        print(json.dumps({"stage": "process", "tool": command[0], "type": "STARTED"}), flush=True)
        try:
            result = subprocess.run(command, cwd=ROOT, env=env, check=False)
        except OSError:
            print(json.dumps({"stage": "process", "tool": command[0], "type": "UNAVAILABLE"}))
            return 2
        if result.returncode:
            print(
                json.dumps(
                    {
                        "stage": "process",
                        "tool": command[0],
                        "type": "FAILED",
                        "exitCode": result.returncode,
                    }
                )
            )
            return result.returncode
    return 0


def native(temporary: Path) -> int:
    artifacts = (
        Artifact(
            "max-sixty/worktrunk",
            "v0.53.0",
            "worktrunk-x86_64-unknown-linux-musl.tar.xz",
            "2d0e810910270955fbf9a7c2d5c61c754eb4fea0c255a960d0acccff65646822",
        ),
        Artifact(
            "vale-cli/vale",
            "v3.24.0",
            "vale_3.24.0_Linux_64-bit.tar.gz",
            "867534ddb678abca7f214bc4706ead0922bd5252ffe8035fc227013f66c8b214",
        ),
        Artifact(
            "JetBrains/kotlin",
            "v2.4.10",
            "kotlin-compiler-2.4.10.zip",
            "473dd66c7a3ef4b182065b3da670466c1bf2773a9dbb0ed8b33a39fe9d4f876d",
        ),
    )
    for artifact in artifacts:
        result = install(artifact, temporary / artifact.repository.split("/")[-1])
        if isinstance(result, SetupFailure):
            print(json.dumps({"stage": "setup", "type": result.value, "tool": artifact.repository}))
            return 2
    kotlin_bin = temporary / "kotlin/kotlinc/bin"
    for file in kotlin_bin.iterdir():
        file.chmod(file.stat().st_mode | 0o111)
    with Path(os.environ["GITHUB_PATH"]).open("a") as output:
        for directory in (
            temporary / "worktrunk/worktrunk-x86_64-unknown-linux-musl",
            temporary / "vale",
            kotlin_bin,
        ):
            _ = output.write(str(directory) + "\n")
    pkl = temporary / "projection-pkl/pkl"
    status = commands(
        (("uv", "run", "--locked", "tools/install_projection_pkl.py", "--out", str(pkl)),)
    )
    if status:
        return status
    with Path(os.environ["GITHUB_ENV"]).open("a") as output:
        _ = output.write(f"PKL_BIN={pkl}\n")
        _ = output.write(
            f"TEST_VALE_ARCHIVE={temporary / 'vale/vale_3.24.0_Linux_64-bit.tar.gz'}\n"
        )
    # Only the retained parent-session adapter needs Zsh; no shell authoring suite.
    return commands((("sudo", "apt-get", "update"), ("sudo", "apt-get", "install", "--yes", "zsh")))


def pkl_smoke(temporary: Path) -> int:
    fixture = temporary / "pkl-agent-fixture"
    _ = shutil.copytree(
        ROOT / "source/skills/pkl-engineering/scripts/tests/fixtures/project", fixture
    )
    facade = str(ROOT / "source/skills/pkl-engineering/scripts/pkl_agent")
    common = (
        "uv",
        "run",
        "--locked",
        "python",
        facade,
        "--workspace",
        str(fixture),
        "--pkl-bin",
        os.environ["PKL_BIN"],
    )
    operations = (
        ("format", "check", "--all"),
        ("imports", "config.pkl"),
        ("module", "validate", "config.pkl"),
        ("module", "inspect", "config.pkl", "--expression", "service.port"),
        ("module", "render", "config.pkl", "--format", "json", "--out", "build/config.json"),
        ("test", "run"),
        ("project", "resolve"),
        ("package", "verify"),
    )
    status = commands(tuple((*common, *operation) for operation in operations))
    if status:
        return status
    _ = json.loads((fixture / "build/config.json").read_text())
    with (temporary / "pkl-agent-home.toon").open("w") as output:
        result = subprocess.run(common, cwd=ROOT, stdout=output, check=False)
    if result.returncode:
        return result.returncode
    return commands(
        (
            (
                "npx",
                "--yes",
                "@toon-format/cli@2.3.0",
                str(temporary / "pkl-agent-home.toon"),
                "--output",
                str(temporary / "pkl-agent-home.json"),
            ),
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("task", type=Task, choices=list(Task))
    task: Task = parser.parse_args().task
    temporary = Path(os.environ["RUNNER_TEMP"]) / "slopsentral-ci"
    temporary.mkdir(exist_ok=True)
    match task:
        case Task.NATIVE:
            return native(temporary)
        case Task.UNIT:
            # All retained unittest suites are collected by pytest; no parallel
            # shell list can silently omit newly added Python tests.
            return commands((("uv", "run", "--locked", "pytest", "source", "tools/python_checks"),))
        case Task.KOTLIN:
            return commands((("uv", "run", "--locked", "tools/compile_kotlin_concepts.py"),))
        case Task.PKL:
            return pkl_smoke(temporary)
        case Task.VALIDATE:
            schemas = (
                "source/schemas/pi/candidate.schema.json",
                "source/schemas/pi/promotion.schema.json",
                "source/schemas/catalog/catalog.schema.json",
                "source/schemas/primitives/resource-reference.schema.json",
                "source/schemas/evals/routing-field-observations.schema.json",
                "source/skills/issue-tracker-operations/references/issue-backend-result.schema.json",
                "source/skills/controlled-technical-writing/references/text-assessment.schema.json",
            )
            return commands(
                (
                    ("npm", "run", "check:source"),
                    ("uv", "run", "--locked", "tools/check.py"),
                    ("node", "tools/run-routing-evals.mjs", "--require-all-fixtures"),
                    *(
                        (
                            "node",
                            "source/skills/manage-json-schemas/scripts/schema-contracts.js",
                            "policy",
                            "--schema",
                            schema,
                        )
                        for schema in schemas
                    ),
                    (
                        "node",
                        "source/skills/manage-json-schemas/scripts/schema-contracts.js",
                        "profile",
                        "--schema",
                        "source/schemas/evals/routing-cases.schema.json",
                    ),
                    ("npm", "test"),
                )
            )
    assert_never(task)


if __name__ == "__main__":
    raise SystemExit(main())
