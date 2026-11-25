"""Bootstrap pinned checkout tools with the system Python, before uv is available."""

from __future__ import annotations

import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from dataclasses import dataclass
from http.client import HTTPException
from pathlib import Path
from typing import TYPE_CHECKING
from urllib.parse import urlsplit
from urllib.request import build_opener

if TYPE_CHECKING:
    from collections.abc import Callable, Mapping
    from typing import TypeGuard

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "tools/toolchain.json"


@dataclass(frozen=True)
class Failure:
    reason: str
    detail: str = ""


@dataclass(frozen=True)
class Asset:
    url: str
    sha256: str
    format: str
    executable: str


@dataclass(frozen=True)
class Tool:
    version: str
    profiles: tuple[str, ...]
    assets: Mapping[str, Asset]
    environment: str
    archive_environment: str


def record(value: object) -> TypeGuard[dict[str, object]]:
    # JSON object keys are always strings.
    return isinstance(value, dict)


def sequence(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def string(value: object) -> str:
    if not isinstance(value, str):
        raise TypeError
    return value


def parse_asset(value: object) -> Asset:
    if not record(value):
        raise ValueError
    asset = Asset(*(string(value[key]) for key in ("url", "sha256", "format", "executable")))
    url = urlsplit(asset.url)
    if (
        url.scheme != "https"
        or url.netloc != "github.com"
        or not Path(url.path).name
        or not re.fullmatch("[0-9a-f]{64}", asset.sha256)
        or asset.format not in {"binary", "tar.gz", "tar.xz", "zip"}
        or any(part in {"", "..", "."} for part in asset.executable.split("/"))
    ):
        raise ValueError
    return asset


def parse_tool(name: str, value: object) -> Tool:
    if not record(value) or not re.fullmatch("[a-z][a-z0-9-]*", name):
        raise ValueError
    version = string(value["version"])
    profiles, assets = value["profiles"], value["assets"]
    if (
        not re.fullmatch(r"[A-Za-z0-9._+-]+", version)
        or not sequence(profiles)
        or not record(assets)
    ):
        raise ValueError
    return Tool(
        version,
        tuple(string(profile) for profile in profiles),
        {key: parse_asset(asset) for key, asset in assets.items()},
        string(value.get("environment", "")),
        string(value.get("archiveEnvironment", "")),
    )


def load_manifest(raw: str) -> dict[str, Tool] | Failure:
    try:
        doc: object = json.loads(raw)
        if (
            not record(doc)
            or isinstance(doc.get("schemaVersion"), bool)
            or doc.get("schemaVersion") != 1
        ):
            return Failure("INVALID_MANIFEST")
        tools = doc["tools"]
        if not record(tools):
            return Failure("INVALID_MANIFEST")
        return {name: parse_tool(name, value) for name, value in tools.items()}
    except (TypeError, ValueError, KeyError):
        return Failure("INVALID_MANIFEST")


def current_platform() -> str:
    arch = platform.machine().lower()
    arch = {"x86_64": "x64", "amd64": "x64", "aarch64": "arm64"}.get(arch, arch)
    return f"{sys.platform}-{arch}"


def cache_root(env: Mapping[str, str]) -> Path:
    base = Path(env.get("XDG_CACHE_HOME") or Path.home() / ".cache")
    return Path(env.get("SLOPSENTRAL_TOOLCHAIN_CACHE") or base / "slopsentral/toolchain").resolve()


@dataclass(frozen=True)
class Entry:
    name: str
    tool: Tool
    asset: Asset
    directory: Path

    @property
    def archive(self) -> Path:
        return self.directory / Path(urlsplit(self.asset.url).path).name

    @property
    def executable(self) -> Path:
        return self.directory / "root" / self.asset.executable

    def ready(self) -> bool:
        return (self.directory / ".complete").is_file() and self.executable.is_file()


def entries(
    manifest: Mapping[str, Tool], names: list[str], profile: str, host: str, cache: Path
) -> list[Entry] | Failure:
    selected = names or [
        name
        for name, tool in manifest.items()
        if profile in tool.profiles and (host in tool.assets or "any" in tool.assets)
    ]
    result: list[Entry] = []
    for name in selected:
        tool = manifest.get(name)
        if tool is None:
            return Failure("UNKNOWN_TOOL", name)
        asset = tool.assets.get(host) or tool.assets.get("any")
        if asset is None:
            return Failure("UNSUPPORTED_PLATFORM", f"{name} on {host}")
        result.append(
            Entry(name, tool, asset, cache / f"{name}-{tool.version}-{asset.sha256[:16]}")
        )
    return result


def download(url: str, path: Path) -> Failure | None:
    try:
        with build_opener().open(url, timeout=300) as response, path.open("wb") as output:
            shutil.copyfileobj(response, output)
    except (OSError, HTTPException) as error:
        return Failure("DOWNLOAD_FAILED", str(error))
    return None


def unpack(asset: Asset, archive: Path, root: Path) -> Failure | None:
    root.mkdir()
    try:
        if asset.format == "binary":
            _ = shutil.copyfile(archive, root / asset.executable)
        elif asset.format == "zip":
            with zipfile.ZipFile(archive) as zipped:
                for item in zipped.infolist():
                    _ = zipped.extract(item, root)
        else:
            with tarfile.open(archive, "r:*") as packed:
                # Only checksum-admitted release archives reach extraction.
                for member in packed:
                    relative = Path(member.name)
                    if relative.is_absolute() or ".." in relative.parts:
                        return Failure("EXTRACT_FAILED", asset.executable)
                    destination = root / relative
                    if member.isdir():
                        destination.mkdir(parents=True, exist_ok=True)
                        continue
                    if not member.isfile():
                        return Failure("EXTRACT_FAILED", asset.executable)
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    content = packed.extractfile(member)
                    if content is None:
                        return Failure("EXTRACT_FAILED", asset.executable)
                    with content, destination.open("wb") as output:
                        shutil.copyfileobj(content, output)
                    destination.chmod(member.mode & 0o777)
    except (OSError, tarfile.TarError, zipfile.BadZipFile, EOFError):
        return Failure("EXTRACT_FAILED", asset.executable)
    return None


def file_sha256(archive: Path) -> str:
    digest = hashlib.sha256()
    with archive.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def fetch(
    entry: Entry, retrieve: Callable[[str, Path], Failure | None] = download
) -> Failure | None:
    if entry.ready():
        return None
    entry.directory.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=entry.directory.parent, prefix=f".{entry.name}-") as temp:
        stage = Path(temp)
        archive = stage / entry.archive.name
        failure = retrieve(entry.asset.url, archive)
        if failure:
            return failure
        if file_sha256(archive) != entry.asset.sha256:
            return Failure("DIGEST_MISMATCH", entry.name)
        failure = unpack(entry.asset, archive, stage / "root")
        if failure:
            return failure
        executable = stage / "root" / entry.asset.executable
        if not executable.is_file():
            return Failure("EXECUTABLE_MISSING", entry.name)
        for file in executable.parent.iterdir():
            if file.is_file():
                file.chmod(file.stat().st_mode | 0o755)
        marker = {"name": entry.name, "version": entry.tool.version, "sha256": entry.asset.sha256}
        _ = (stage / ".complete").write_text(json.dumps(marker) + "\n")
        try:
            _ = stage.rename(entry.directory)
        except OSError:
            if not entry.ready():
                raise
    return None


def environment(selected: list[Entry]) -> tuple[dict[str, str], list[str]]:
    variables: dict[str, str] = {}
    directories = [str(ROOT / "bin")]
    for entry in selected:
        directories.append(str(entry.executable.parent))
        if entry.tool.environment:
            variables[entry.tool.environment] = str(entry.executable)
        if entry.tool.archive_environment:
            variables[entry.tool.archive_environment] = str(entry.archive)
    return variables, directories


def provision(command: str, selected: list[Entry]) -> Failure | None:
    for entry in selected:
        failure = fetch(entry)
        if failure:
            return failure
        if command == "fetch":
            print(
                json.dumps(
                    {
                        "type": "TOOL_READY",
                        "name": entry.name,
                        "version": entry.tool.version,
                        "executable": str(entry.executable),
                    }
                )
            )
    return None


def execute(command: str, selected: list[Entry], child: list[str]) -> int | Failure:
    if command in {"fetch", "run"}:
        failure = provision(command, selected)
        if failure or command == "fetch":
            return failure or 0
    for entry in selected:
        if not entry.ready():
            return Failure("NOT_FETCHED", entry.name)
    variables, directories = environment(selected)
    if command == "env":
        for key, value in variables.items():
            print(f"{key}={value}")
    elif command == "paths":
        print("\n".join(directories))
    elif command == "path":
        print(selected[0].executable)
    else:
        env = dict(os.environ)
        env.update({key: value for key, value in variables.items() if not env.get(key)})
        env["PATH"] = os.pathsep.join([*directories, env.get("PATH", "")])
        try:
            return subprocess.run(child, env=env, check=False).returncode
        except OSError as error:
            return Failure("COMMAND_FAILED", str(error))
    return 0


def run(argv: list[str]) -> int | Failure:
    if not argv or argv[0] not in {"fetch", "run", "env", "paths", "path"}:
        return Failure("INVALID_INVOCATION", "use fetch, run, path, env, or paths")
    separator = argv.index("--") if "--" in argv else len(argv)
    command, options, child = argv[0], argv[1:separator], argv[separator + 1 :]
    profile = "core"
    if "--profile" in options:
        index = options.index("--profile")
        if options[index + 1 : index + 2] not in (["core"], ["ci"]):
            return Failure("INVALID_INVOCATION", "expected profile core or ci")
        profile = options[index + 1]
        del options[index : index + 2]
    if (command == "run" and not child) or (command == "path" and len(options) != 1):
        return Failure("INVALID_INVOCATION", command)
    tools = load_manifest(MANIFEST.read_text())
    if isinstance(tools, Failure):
        return tools
    selected = entries(tools, options, profile, current_platform(), cache_root(os.environ))
    return selected if isinstance(selected, Failure) else execute(command, selected, child)


if __name__ == "__main__":
    try:
        outcome = run(sys.argv[1:])
    except OSError as error:
        outcome = Failure("IO_FAILED", str(error))
    if isinstance(outcome, Failure):
        print(
            json.dumps(
                {"type": "TOOLCHAIN_REJECTED", "reason": outcome.reason, "detail": outcome.detail}
            ),
            file=sys.stderr,
        )
        sys.exit(
            69
            if outcome.reason in {"NOT_FETCHED", "UNSUPPORTED_PLATFORM", "DOWNLOAD_FAILED"}
            else 2
        )
    sys.exit(outcome if outcome >= 0 else 128 - outcome)
