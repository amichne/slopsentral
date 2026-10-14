#!/usr/bin/env -S uv run --locked --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = []
# [tool.uv]
# no-build = true
# required-version = ">=0.12.9"
# ///
"""Install a pinned CLI and bundled rules without CMS, MCP, or package sync."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import platform
import re
import shutil
import subprocess
import tarfile
import tempfile
import urllib.error
import urllib.request
import zipfile
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from http.client import HTTPException, HTTPMessage
from pathlib import Path, PurePosixPath
from typing import IO, TypeGuard, assert_never, override
from urllib.parse import urlsplit

VERSION = "3.24.0"
BUNDLE = Path(__file__).resolve().parents[1] / "assets/vale"
MAX_ARCHIVE = 32 * 1024 * 1024
MAX_BINARY = 100 * 1024 * 1024
_GITHUB_HOSTS = frozenset(
    {"github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"}
)


class FailureCode(StrEnum):
    UNSUPPORTED_PLATFORM = "UNSUPPORTED_PLATFORM"
    DESTINATION_EXISTS = "DESTINATION_EXISTS"
    INVALID_BUNDLE = "INVALID_BUNDLE"
    DOWNLOAD_FAILED = "DOWNLOAD_FAILED"
    DIGEST_MISMATCH = "DIGEST_MISMATCH"
    INVALID_ARCHIVE = "INVALID_ARCHIVE"
    VERSION_MISMATCH = "VERSION_MISMATCH"
    SMOKE_FAILED = "SMOKE_FAILED"
    IO_FAILED = "IO_FAILED"


@dataclass(frozen=True, slots=True)
class Failure:
    code: FailureCode


@dataclass(frozen=True, slots=True)
class _Release:
    name: str
    sha256: str
    executable: str


_RELEASES = {
    ("Darwin", "arm64"): _Release(
        "vale_3.24.0_macOS_arm64.tar.gz",
        "87b513f26499f6657c15cf7175ba5b058a7c1ff2bb2d4e07265db2dd43451e44",
        "vale",
    ),
    ("Darwin", "x86_64"): _Release(
        "vale_3.24.0_macOS_64-bit.tar.gz",
        "eeb39e86f1daac27cc2a77fef3af1824d50559bdc22329fb25fb921c80c79472",
        "vale",
    ),
    ("Linux", "arm64"): _Release(
        "vale_3.24.0_Linux_arm64.tar.gz",
        "104cbd349279e50c4cb40adb70adf345d93cc4a3a0191f9e68bdccb97086b582",
        "vale",
    ),
    ("Linux", "x86_64"): _Release(
        "vale_3.24.0_Linux_64-bit.tar.gz",
        "867534ddb678abca7f214bc4706ead0922bd5252ffe8035fc227013f66c8b214",
        "vale",
    ),
    ("Windows", "arm64"): _Release(
        "vale_3.24.0_Windows_arm64.zip",
        "3ec62981d49558d89c2ee2e9836f10db86ca335fdfaa2b701a9fbeca1496a5c7",
        "vale.exe",
    ),
    ("Windows", "x86_64"): _Release(
        "vale_3.24.0_Windows_64-bit.zip",
        "3a8884774973b6f2826877e1c6388a5feae4704ef88a9a9c912c77ce186990f3",
        "vale.exe",
    ),
}


def select_release(system: str, machine: str) -> _Release | Failure:
    architecture = {"aarch64": "arm64", "amd64": "x86_64"}.get(machine.lower(), machine.lower())
    release = _RELEASES.get((system, architecture))
    return release if release is not None else Failure(FailureCode.UNSUPPORTED_PLATFORM)


def allowed_download(url: str) -> bool:
    """The only network adapter permits HTTPS requests to GitHub artifact hosts."""
    try:
        parsed = urlsplit(url)
    except ValueError:
        return False
    return (
        parsed.scheme == "https"
        and parsed.hostname in _GITHUB_HOSTS
        and parsed.netloc == parsed.hostname
        and not parsed.fragment
    )


class _GitHubRedirects(urllib.request.HTTPRedirectHandler):
    @override
    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: IO[bytes],
        code: int,
        msg: str,
        headers: HTTPMessage,
        newurl: str,
    ) -> urllib.request.Request | None:
        if not allowed_download(newurl):
            raise urllib.error.URLError("Redirect outside the GitHub artifact hosts")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download(release: _Release) -> bytes | Failure:
    url = f"https://github.com/vale-cli/vale/releases/download/v{VERSION}/{release.name}"
    # Ignore ambient proxies. No credentials or project content enter this request.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _GitHubRedirects())
    try:
        with opener.open(url, timeout=30) as response:
            raw: bytes = response.read(MAX_ARCHIVE + 1)
    except (OSError, urllib.error.URLError, HTTPException):
        return Failure(FailureCode.DOWNLOAD_FAILED)
    return raw


@dataclass(frozen=True, slots=True)
class _File:
    relative: PurePosixPath
    contents: bytes


@dataclass(frozen=True, slots=True)
class _VerifiedBundle:
    files: tuple[_File, ...]
    policy_sha256: str
    cli_config: bytes
    assessment_config: bytes


def _object_pairs(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate manifest key")
        result[key] = value
    return result


def _is_mapping(value: object) -> TypeGuard[Mapping[object, object]]:
    return isinstance(value, Mapping)


def _is_list(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def load_bundle(root: Path) -> _VerifiedBundle | Failure:
    """Parse the closed lock contract and preserve the exact approved bytes."""
    try:
        lock_bytes = (root / "resources.lock.json").read_bytes()
        lock: object = json.loads(
            lock_bytes,
            object_pairs_hook=_object_pairs,
        )
        if not _is_mapping(lock) or set(lock) != {
            "type",
            "schemaVersion",
            "valeVersion",
            "files",
            "upstream",
        }:
            return Failure(FailureCode.INVALID_BUNDLE)
        if (
            lock["type"] != "VALE_POLICY_LOCK"
            or type(lock["schemaVersion"]) is not int
            or lock["schemaVersion"] != 1
            or lock["valeVersion"] != VERSION
        ):
            return Failure(FailureCode.INVALID_BUNDLE)
        upstream: object = lock["upstream"]
        if not _is_list(upstream):
            return Failure(FailureCode.INVALID_BUNDLE)
        repositories: list[str] = []
        for item in upstream:
            if not _is_mapping(item) or set(item) != {"repository", "revision"}:
                return Failure(FailureCode.INVALID_BUNDLE)
            repository, revision = item["repository"], item["revision"]
            if (
                not isinstance(repository, str)
                or not isinstance(revision, str)
                or re.fullmatch(r"[a-f0-9]{40}", revision) is None
            ):
                return Failure(FailureCode.INVALID_BUNDLE)
            repositories.append(repository)
        if sorted(repositories) != [
            "jdkato/commits",
            "jdkato/diataxis",
            "vale-cli/Google",
            "vale-cli/Std",
            "vale-cli/readability",
        ]:
            return Failure(FailureCode.INVALID_BUNDLE)
        entries: object = lock["files"]
        if not _is_mapping(entries) or not {".vale.ini", "assessment.ini"}.issubset(entries):
            return Failure(FailureCode.INVALID_BUNDLE)
        files: list[_File] = []
        for relative, expected in entries.items():
            if (
                not isinstance(relative, str)
                or not isinstance(expected, str)
                or re.fullmatch(r"[a-f0-9]{64}", expected) is None
            ):
                return Failure(FailureCode.INVALID_BUNDLE)
            path = PurePosixPath(relative)
            if (
                path.is_absolute()
                or ".." in path.parts
                or "\\" in relative
                or ":" in relative
                or str(path) != relative
                or path.parts[0] not in {".vale.ini", "assessment.ini", "styles", "licenses"}
            ):
                return Failure(FailureCode.INVALID_BUNDLE)
            source = root / path
            if source.resolve().is_relative_to(root.resolve()) is False or source.is_symlink():
                return Failure(FailureCode.INVALID_BUNDLE)
            raw = source.read_bytes()
            if hashlib.sha256(raw).hexdigest() != expected:
                return Failure(FailureCode.INVALID_BUNDLE)
            files.append(_File(path, raw))
        actual = {
            path.relative_to(root).as_posix()
            for path in root.rglob("*")
            if path.is_file() and path.name != "resources.lock.json"
        }
        if actual != set(entries):
            return Failure(FailureCode.INVALID_BUNDLE)
        configs = {str(file.relative): file.contents for file in files}
        return _VerifiedBundle(
            tuple(files),
            hashlib.sha256(lock_bytes).hexdigest(),
            configs[".vale.ini"],
            configs["assessment.ini"],
        )
    except (OSError, ValueError, UnicodeError):
        return Failure(FailureCode.INVALID_BUNDLE)


@dataclass(frozen=True, slots=True)
class _VerifiedArchive:
    release: _Release
    binary: bytes
    license: bytes


def verify_archive(raw: bytes, release: _Release) -> _VerifiedArchive | Failure:
    if len(raw) > MAX_ARCHIVE or hashlib.sha256(raw).hexdigest() != release.sha256:
        return Failure(FailureCode.DIGEST_MISMATCH)
    try:
        if release.executable == "vale.exe":
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                binaries = [entry for entry in archive.infolist() if entry.filename == "vale.exe"]
                licenses = [entry for entry in archive.infolist() if entry.filename == "LICENSE"]
                if (
                    len(binaries) != 1
                    or len(licenses) != 1
                    or not 0 < binaries[0].file_size <= MAX_BINARY
                    or licenses[0].file_size > MAX_ARCHIVE
                ):
                    return Failure(FailureCode.INVALID_ARCHIVE)
                return _VerifiedArchive(
                    release, archive.read(binaries[0]), archive.read(licenses[0])
                )
        with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as archive:
            binaries = [entry for entry in archive.getmembers() if entry.name == "vale"]
            licenses = [entry for entry in archive.getmembers() if entry.name == "LICENSE"]
            if (
                len(binaries) != 1
                or len(licenses) != 1
                or not binaries[0].isfile()
                or not licenses[0].isfile()
                or not 0 < binaries[0].size <= MAX_BINARY
                or licenses[0].size > MAX_ARCHIVE
            ):
                return Failure(FailureCode.INVALID_ARCHIVE)
            binary = archive.extractfile(binaries[0])
            license_file = archive.extractfile(licenses[0])
            if binary is None or license_file is None:
                return Failure(FailureCode.INVALID_ARCHIVE)
            with binary, license_file:
                return _VerifiedArchive(release, binary.read(), license_file.read())
    except (tarfile.TarError, zipfile.BadZipFile, OSError, ValueError):
        return Failure(FailureCode.INVALID_ARCHIVE)


@dataclass(frozen=True, slots=True)
class Installed:
    destination: Path
    executable: Path


def install(
    destination: Path, bundle: _VerifiedBundle, archive: _VerifiedArchive
) -> Installed | Failure:
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(
            prefix=".vale-stage-", dir=destination.parent
        ) as directory:
            stage = Path(directory)
            for file in bundle.files:
                target = stage / file.relative
                target.parent.mkdir(parents=True, exist_ok=True)
                _ = target.write_bytes(file.contents)
            executable = stage / "bin" / archive.release.executable
            executable.parent.mkdir()
            _ = executable.write_bytes(archive.binary)
            executable.chmod(0o755)
            license_file = stage / "licenses/vale/LICENSE"
            license_file.parent.mkdir()
            _ = license_file.write_bytes(archive.license)
            version = subprocess.run(
                [str(executable), "--version"],
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
            if version.returncode != 0 or version.stdout.strip() != f"vale version {VERSION}":
                return Failure(FailureCode.VERSION_MISMATCH)
            for text, expected_exit in (
                ("feat: add local prose rules\n\nThe rules stay on disk.\n", 0),
                ("feat: add local prose rules.\n", 1),
            ):
                smoke = subprocess.run(
                    [
                        str(executable),
                        "--no-global",
                        f"--config={stage / '.vale.ini'}",
                        "--output=JSON",
                        "--path=COMMIT_EDITMSG",
                    ],
                    input=text,
                    capture_output=True,
                    text=True,
                    timeout=30,
                    check=False,
                )
                if smoke.returncode != expected_exit:
                    return Failure(FailureCode.SMOKE_FAILED)
                try:
                    findings: object = json.loads(smoke.stdout, object_pairs_hook=_object_pairs)
                except ValueError:
                    return Failure(FailureCode.SMOKE_FAILED)
                if not _is_mapping(findings):
                    return Failure(FailureCode.SMOKE_FAILED)
                if expected_exit == 0:
                    if findings:
                        return Failure(FailureCode.SMOKE_FAILED)
                else:
                    alerts = findings.get("COMMIT_EDITMSG")
                    if not _is_list(alerts) or not any(
                        _is_mapping(alert)
                        and alert.get("Check") == "Slopsentral.CommitPeriod"
                        and alert.get("Severity") == "error"
                        for alert in alerts
                    ):
                        return Failure(FailureCode.SMOKE_FAILED)
            # copytree refuses every existing destination, including an empty directory or symlink.
            _ = shutil.copytree(stage, destination)
        return Installed(destination, destination / "bin" / archive.release.executable)
    except FileExistsError:
        return Failure(FailureCode.DESTINATION_EXISTS)
    except (OSError, subprocess.TimeoutExpired):
        return Failure(FailureCode.IO_FAILED)


def setup(destination: Path, archive_path: Path | None) -> Installed | Failure:
    if destination.exists() or destination.is_symlink():
        return Failure(FailureCode.DESTINATION_EXISTS)
    release = select_release(platform.system(), platform.machine())
    if isinstance(release, Failure):
        return release
    bundle = load_bundle(BUNDLE)
    if isinstance(bundle, Failure):
        return bundle
    if archive_path is None:
        raw = download(release)
    else:
        try:
            with archive_path.open("rb") as source:
                raw = source.read(MAX_ARCHIVE + 1)
        except OSError:
            return Failure(FailureCode.IO_FAILED)
    if isinstance(raw, Failure):
        return raw
    archive = verify_archive(raw, release)
    if isinstance(archive, Failure):
        return archive
    return install(destination, bundle, archive)


def output(outcome: Installed | Failure) -> tuple[dict[str, str], int]:
    match outcome:
        case Installed(destination, executable):
            return {
                "type": "INSTALLED",
                "valeVersion": VERSION,
                "destination": str(destination),
                "executable": str(executable),
                "config": str(destination / ".vale.ini"),
            }, 0
        case Failure(code):
            return {"type": "FAILED", "code": code.value}, 1
    assert_never(outcome)


class _Arguments(argparse.Namespace):
    destination: Path | None = None
    archive: Path | None = None
    self_test: bool = False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument(
        "--destination", type=Path, help="New directory for the CLI and configuration"
    )
    _ = parser.add_argument(
        "--archive", type=Path, help="Pinned release archive for offline installation"
    )
    _ = parser.add_argument(
        "--self-test", action="store_true", help="Examine bundled policy integrity"
    )
    args = parser.parse_args(namespace=_Arguments())
    if args.self_test:
        bundle = load_bundle(BUNDLE)
        if isinstance(bundle, Failure):
            payload, code = output(bundle)
        else:
            payload, code = {"type": "SELF_TEST_PASSED", "valeVersion": VERSION}, 0
    else:
        if args.destination is None:
            parser.error("--destination is necessary")
        payload, code = output(setup(args.destination.absolute(), args.archive))
    print(json.dumps(payload, sort_keys=True))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
