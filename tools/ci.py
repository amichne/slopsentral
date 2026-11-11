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
import io
import json
import os
import shutil
import subprocess
import tarfile
import tempfile
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass
from enum import StrEnum
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from threading import Thread
from typing import assert_never

ROOT = Path(__file__).resolve().parents[1]
# Debian trixie zsh-static 5.9-8+b24 for amd64.
ZSH_URL = "https://snapshot.debian.org/file/3d0ecc417012b5aee852cd5dee79d5db1342eae6"
ZSH_SHA256 = "ca5ea751bcbf805759b335743776ebd05ce8f2ab02459e9ef3ffd08c4b7c2800"


class Task(StrEnum):
    NATIVE = "native"
    VALIDATE = "validate"
    UNIT = "unit"
    KOTLIN = "kotlin"
    PKL = "pkl"
    DOCS = "docs"
    PREVIEW = "preview"


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


def download(url: str, archive: Path, expected_digest: str) -> SetupFailure | None:
    try:
        with urllib.request.urlopen(url, timeout=60) as response, archive.open("wb") as output:  # noqa: S310 -- callers use pinned HTTPS artifacts
            shutil.copyfileobj(response, output)
        with archive.open("rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
    except urllib.error.URLError:
        return SetupFailure.DOWNLOAD
    except OSError:
        return SetupFailure.FILESYSTEM
    return None if digest == expected_digest else SetupFailure.CHECKSUM


def install(artifact: Artifact, target: Path) -> Installed | SetupFailure:
    url = f"https://github.com/{artifact.repository}/releases/download/{artifact.tag}/{artifact.filename}"
    try:
        target.mkdir(parents=True, exist_ok=False)
        archive = target / artifact.filename
        failure = download(url, archive, artifact.sha256)
        if failure is not None:
            return failure
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
    except (tarfile.TarError, zipfile.BadZipFile):
        return SetupFailure.ARCHIVE
    except OSError:
        return SetupFailure.FILESYSTEM


def install_zsh(target: Path) -> Installed | SetupFailure:
    try:
        target.mkdir(parents=True, exist_ok=False)
        archive = target / "zsh.deb"
        failure = download(ZSH_URL, archive, ZSH_SHA256)
        if failure is not None:
            return failure
        payload = subprocess.run(
            ["ar", "p", str(archive), "data.tar.xz"],
            capture_output=True,
            check=False,
        )
        if payload.returncode != 0:
            return SetupFailure.ARCHIVE
        with tarfile.open(fileobj=io.BytesIO(payload.stdout), mode="r:xz") as data:
            member = data.getmember("./usr/bin/zsh-static")
            binary = data.extractfile(member) if member.isfile() else None
            if binary is None:
                return SetupFailure.ARCHIVE
            directory = target / "bin"
            directory.mkdir()
            command = directory / "zsh"
            with binary, command.open("xb") as output:
                shutil.copyfileobj(binary, output)
            command.chmod(0o755)
        return Installed(directory)
    except (KeyError, tarfile.TarError):
        return SetupFailure.ARCHIVE
    except OSError:
        return SetupFailure.FILESYSTEM


def commands(
    items: tuple[tuple[str, ...], ...],
    *,
    env: dict[str, str] | None = None,
    cwd: Path = ROOT,
) -> int:
    for command in items:
        print(json.dumps({"stage": "process", "tool": command[0], "type": "STARTED"}), flush=True)
        try:
            result = subprocess.run(command, cwd=cwd, env=env, check=False)
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
    zsh = install_zsh(temporary / "zsh")
    if isinstance(zsh, SetupFailure):
        print(json.dumps({"stage": "setup", "type": zsh.value, "tool": "zsh"}))
        return 2
    kotlin_bin = temporary / "kotlin/kotlinc/bin"
    for file in kotlin_bin.iterdir():
        file.chmod(file.stat().st_mode | 0o111)
    with Path(os.environ["GITHUB_PATH"]).open("a") as output:
        for directory in (
            temporary / "worktrunk/worktrunk-x86_64-unknown-linux-musl",
            temporary / "vale",
            kotlin_bin,
            zsh.directory,
        ):
            _ = output.write(str(directory) + "\n")
    pkl = temporary / "projection-pkl/pkl"
    status = commands((("node", "tools/install-projection-pkl.mjs", "--out", str(pkl)),))
    if status:
        return status
    with Path(os.environ["GITHUB_ENV"]).open("a") as output:
        _ = output.write(f"PKL_BIN={pkl}\n")
        _ = output.write(
            f"TEST_VALE_ARCHIVE={temporary / 'vale/vale_3.24.0_Linux_64-bit.tar.gz'}\n"
        )
    return 0


class UnpublishedPackage(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        self.send_error(HTTPStatus.NOT_FOUND)


def pkl_smoke(temporary: Path) -> int:
    with HTTPServer(("127.0.0.1", 0), UnpublishedPackage) as registry:
        worker = Thread(target=registry.serve_forever, daemon=True)
        worker.start()
        try:
            return pkl_fixture(temporary, registry.server_port)
        finally:
            registry.shutdown()
            worker.join()


def pkl_fixture(temporary: Path, registry_port: int) -> int:
    fixture = temporary / "pkl-agent-fixture"
    _ = shutil.copytree(
        ROOT / "source/skills/pkl-engineering/scripts/tests/fixtures/project", fixture
    )
    project = fixture / "PklProject"
    _ = project.write_text(
        project.read_text()
        + "\nevaluatorSettings {\n  http {\n    rewrites {\n"
        + f'      ["https://example.com/"] = "http://127.0.0.1:{registry_port}/"\n'
        + "    }\n  }\n}\n"
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
        "--allow-resource",
        f"http://127[.]0[.]0[.]1:{registry_port}/pkl-agent-fixture@1[.]0[.]0(?:[.]zip)?$",
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


def documentation(task: Task) -> int:
    status = commands((("uv", "run", "--locked", "--script", "tools/public_docs.py", "check"),))
    if status:
        return status
    mint = str(ROOT / "docs/tooling/node_modules/.bin/mint")
    operations = (
        ((mint, "dev", "--no-open"),)
        if task is Task.PREVIEW
        else (
            (mint, "validate"),
            (mint, "broken-links", "--check-anchors", "--check-redirects"),
        )
    )
    return commands(operations, cwd=ROOT / "docs/public")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("task", type=Task, choices=list(Task))
    task: Task = parser.parse_args().task
    temporary = Path(os.environ.get("RUNNER_TEMP", tempfile.gettempdir())) / "slopsentral-ci"
    temporary.mkdir(exist_ok=True)
    match task:
        case Task.DOCS | Task.PREVIEW:
            return documentation(task)
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
                "source/schemas/catalog/catalog.schema.json",
                "source/schemas/primitives/resource-reference.schema.json",
                "source/schemas/evals/routing-field-observations.schema.json",
                "source/skills/issue-tracker-operations/references/issue-backend-result.schema.json",
                "source/skills/controlled-technical-writing/references/glossary.schema.json",
            )
            return commands(
                (
                    ("npm", "run", "check:source"),
                    ("npm", "run", "check:docs"),
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
