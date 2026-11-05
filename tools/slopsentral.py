#!/usr/bin/env -S uv run --locked --script
# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = ["fzf-bin==0.73.1"]
# [tool.uv]
# no-build = true
# required-version = ">=0.12.9"
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""Install, update, or remove Slopsentral through an explicit host."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zlib
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path, PurePosixPath
from typing import Literal, Self, TypeGuard

REPOSITORY = "amichne/slopsentral"
API = f"https://api.github.com/repos/{REPOSITORY}"
DOWNLOAD = f"https://github.com/{REPOSITORY}/releases/download"
MAX_BYTES = 64 * 1024 * 1024
VERSION = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\Z")
IDENTITY = re.compile(r"[a-z][a-z0-9-]*\Z")


class PluginName(str):
    __slots__ = ()

    def __new__(cls, value: str) -> Self:
        if not IDENTITY.fullmatch(value):
            message = "Use a plugin identifier with lowercase letters, digits, and hyphens."
            raise ValueError(message)
        return super().__new__(cls, value)


class Action(StrEnum):
    INSTALL = "install"
    UPDATE = "update"
    REMOVE = "remove"


class Host(StrEnum):
    CODEX = "codex"
    COPILOT = "copilot"
    AMP = "amp"
    PI = "pi"


type NativeHost = Literal[Host.CODEX, Host.COPILOT]


class AllPlugins(StrEnum):
    ALL = "all"


type Selection = tuple[PluginName, ...] | AllPlugins


class Marketplace(StrEnum):
    ABSENT = "absent"
    REGISTERED = "registered"


class Reason(StrEnum):
    HOST_UNAVAILABLE = "HOST_UNAVAILABLE"
    HOST_FAILED = "HOST_FAILED"
    INVALID_RECORD = "INVALID_RECORD"
    FOREIGN_SOURCE = "FOREIGN_SOURCE"
    PLUGIN_DISABLED = "PLUGIN_DISABLED"
    NOT_INSTALLED = "NOT_INSTALLED"
    DOWNLOAD_FAILED = "DOWNLOAD_FAILED"
    INVALID_RELEASE = "INVALID_RELEASE"
    CHECKSUM_MISMATCH = "CHECKSUM_MISMATCH"
    UNSAFE_ARCHIVE = "UNSAFE_ARCHIVE"
    OWNERSHIP_CONFLICT = "OWNERSHIP_CONFLICT"
    IO_FAILED = "IO_FAILED"
    TERMINAL_REQUIRED = "TERMINAL_REQUIRED"
    SELECTOR_FAILED = "SELECTOR_FAILED"
    CANCELLED = "CANCELLED"


@dataclass(frozen=True)
class Rejected:
    reason: Reason
    detail: str


type Result[T] = T | Rejected


def mapping(value: object) -> TypeGuard[Mapping[object, object]]:
    return isinstance(value, Mapping)


def sequence(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def parse(data: bytes) -> Result[object]:
    try:
        result: object = json.loads(data)
    except (ValueError, UnicodeError):
        return Rejected(Reason.INVALID_RECORD, "Expected JSON.")
    return result


def process(arguments: list[str]) -> Result[bytes]:
    try:
        result = subprocess.run(arguments, capture_output=True, check=False, timeout=120)
    except FileNotFoundError:
        return Rejected(Reason.HOST_UNAVAILABLE, arguments[0])
    except subprocess.TimeoutExpired:
        return Rejected(Reason.HOST_FAILED, f"{arguments[0]} exceeded 120 seconds.")
    if result.returncode:
        # Native commands own their diagnostics; stdout of this command stays JSON.
        _ = sys.stderr.buffer.write(result.stderr[:8192] + result.stdout[:8192])
        return Rejected(Reason.HOST_FAILED, f"{arguments[0]} exited {result.returncode}.")
    return result.stdout


def fetch(url: str) -> Result[bytes]:
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    authenticated = url.startswith(API + "/") and token is not None
    if authenticated and token is not None and not re.fullmatch(r"[A-Za-z0-9_.-]+", token):
        return Rejected(Reason.DOWNLOAD_FAILED, "Unsupported token characters.")
    try:
        result = subprocess.run(
            [
                "curl",
                "--fail",
                "--silent",
                "--show-error",
                "--no-insecure",
                "--no-proxy-insecure",
                "--no-location-trusted",
                "--location",
                "--proto",
                "=https",
                "--proto-redir",
                "=https",
                "--max-time",
                "60",
                "--max-filesize",
                str(MAX_BYTES),
                *(["--header", "@-"] if authenticated else []),
                url,
            ],
            input=f"Authorization: Bearer {token}\n".encode() if authenticated else b"",
            capture_output=True,
            check=False,
            timeout=65,
        )
    except (OSError, subprocess.TimeoutExpired):
        return Rejected(Reason.DOWNLOAD_FAILED, "curl could not complete the HTTPS request.")
    if result.returncode or len(result.stdout) > MAX_BYTES:
        return Rejected(
            Reason.DOWNLOAD_FAILED,
            f"curl exited {result.returncode}; examine proxy and certificate settings.",
        )
    return result.stdout


@dataclass(frozen=True)
class _Release:
    version: str
    assets: tuple[Mapping[object, object], ...]

    @staticmethod
    def latest(version: str | None = None) -> Result[_Release]:
        route = f"/releases/tags/slopsentral-v{version}" if version else "/releases/latest"
        data = fetch(API + route)
        if isinstance(data, Rejected):
            return data
        value = parse(data)
        if not mapping(value):
            return Rejected(Reason.INVALID_RELEASE, "Expected a stable Slopsentral release.")
        tag, assets = value.get("tag_name"), value.get("assets")
        if (
            not isinstance(tag, str)
            or not tag.startswith("slopsentral-v")
            or not VERSION.fullmatch(tag.removeprefix("slopsentral-v"))
            or value.get("draft") is not False
            or value.get("prerelease") is not False
            or not sequence(assets)
            or not all(mapping(item) for item in assets)
        ):
            return Rejected(Reason.INVALID_RELEASE, "Expected stable release metadata.")
        selected = tag.removeprefix("slopsentral-v")
        if version is not None and selected != version:
            return Rejected(Reason.INVALID_RELEASE, "Requested version differs.")
        return _Release(selected, tuple(item for item in assets if mapping(item)))

    def asset(self, name: str) -> Result[bytes]:
        matches = [item for item in self.assets if item.get("name") == name]
        url = f"{DOWNLOAD}/slopsentral-v{self.version}/{name}"
        if len(matches) != 1 or matches[0].get("browser_download_url") != url:
            return Rejected(Reason.INVALID_RELEASE, f"Missing unique release asset: {name}")
        data = fetch(url)
        if isinstance(data, Rejected):
            return data
        if (
            matches[0].get("size") != len(data)
            or matches[0].get("digest") != "sha256:" + hashlib.sha256(data).hexdigest()
        ):
            return Rejected(Reason.CHECKSUM_MISMATCH, name)
        return data


def catalog_bytes(data: bytes) -> Result[bytes]:
    try:
        decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
        expanded = decoder.decompress(data, MAX_BYTES + 1)
        if len(expanded) > MAX_BYTES or not decoder.eof or decoder.unused_data:
            return Rejected(Reason.UNSAFE_ARCHIVE, "Oversized or incomplete catalog archive.")
        with tarfile.open(fileobj=io.BytesIO(expanded), mode="r:") as archive:
            members = [
                item
                for item in archive.getmembers()
                if item.name == ".agents/plugins/marketplace.json"
            ]
            if len(members) != 1 or not members[0].isfile():
                return Rejected(Reason.INVALID_RELEASE, "Missing unique plugin catalog.")
            source = archive.extractfile(members[0])
            if source is None:
                return Rejected(Reason.INVALID_RELEASE, "Missing plugin catalog bytes.")
            with source:
                return source.read(MAX_BYTES + 1)
    except (tarfile.TarError, zlib.error, EOFError):
        return Rejected(Reason.UNSAFE_ARCHIVE, "Invalid catalog archive.")


def catalog_names(value: object) -> Result[tuple[PluginName, ...]]:
    rows = value.get("plugins") if mapping(value) and value.get("name") == "slopsentral" else None
    if not sequence(rows) or not rows:
        return Rejected(Reason.INVALID_RELEASE, "Expected a nonempty plugin catalog.")
    names: list[PluginName] = []
    for row in rows:
        name = row.get("name") if mapping(row) else None
        if not isinstance(name, str):
            return Rejected(Reason.INVALID_RELEASE, "Invalid catalog plugin.")
        try:
            names.append(PluginName(name))
        except ValueError:
            return Rejected(Reason.INVALID_RELEASE, "Invalid catalog plugin identity.")
    if len(set(names)) != len(names):
        return Rejected(Reason.INVALID_RELEASE, "Duplicate catalog plugin.")
    return tuple(names)


def release_plugins(release: _Release) -> Result[tuple[PluginName, ...]]:
    data = release.asset("slopsentral-codex.tar.gz")
    if isinstance(data, Rejected):
        return data
    catalog = catalog_bytes(data)
    return catalog if isinstance(catalog, Rejected) else catalog_names(parse(catalog))


def all_names(version: str | None = None) -> Result[tuple[PluginName, ...]]:
    release = _Release.latest(version)
    return release if isinstance(release, Rejected) else release_plugins(release)


def native_selection(
    action: Action, plugins: Selection, own: dict[PluginName, InstalledPlugin]
) -> Result[tuple[PluginName, ...]]:
    if not isinstance(plugins, AllPlugins):
        return plugins
    return all_names() if action is Action.INSTALL else tuple(own)


def direct(path: Path) -> bool:
    return not any(parent.is_symlink() for parent in (path, *path.parents))


def atomic(path: Path, data: bytes, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(prefix=".slopsentral-", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, "wb") as output:
            _ = output.write(data)
        temporary.chmod(mode)
        _ = temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def data_home() -> Path:
    return Path(os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local/share"))) / "slopsentral"


def command(action: Action, version: str | None) -> Result[dict[str, object]]:
    directory = data_home() / "command"
    executable = Path.home() / ".local/bin/slopsentral"
    if not direct(directory) or not direct(executable):
        return Rejected(Reason.OWNERSHIP_CONFLICT, "Indirect command path.")
    # An exclusive directory serializes updates and removal. Stale locks fail closed.
    directory.parent.mkdir(parents=True, exist_ok=True)
    lock = directory.parent / ".command-lock"
    try:
        lock.mkdir()
    except FileExistsError:
        return Rejected(Reason.OWNERSHIP_CONFLICT, f"Another operation or interruption owns {lock}")
    try:
        return locked_command(action, version, directory, executable)
    finally:
        lock.rmdir()


def admit_command(directory: Path, executable: Path) -> Result[None]:
    receipt = directory / "receipt.json"
    if directory.exists():
        if not receipt.is_file() or not direct(receipt):
            return Rejected(Reason.OWNERSHIP_CONFLICT, str(directory))
        saved = parse(receipt.read_bytes())
        if (
            not mapping(saved)
            or not mapping(saved.get("files"))
            or not isinstance(saved.get("launcher"), str)
        ):
            return Rejected(Reason.OWNERSHIP_CONFLICT, "Invalid command receipt.")
        files = saved["files"]
        if not mapping(files):
            return Rejected(Reason.OWNERSHIP_CONFLICT, "Invalid command inventory.")
        actual = {
            path.relative_to(directory).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in directory.rglob("*")
            if path.is_file() and path != receipt and direct(path)
        }
        if (
            actual != files
            or any(
                not direct(path) or not (path.is_file() or path.is_dir())
                for path in directory.rglob("*")
            )
            or not executable.is_file()
            or executable.read_text() != saved["launcher"]
        ):
            return Rejected(
                Reason.OWNERSHIP_CONFLICT, "Command files changed; files remain intact."
            )
    elif executable.exists():
        return Rejected(Reason.OWNERSHIP_CONFLICT, str(executable))
    return None


def command_source(action: Action, version: str | None) -> Result[tuple[bytes, bytes]]:
    if action == "update":
        release = _Release.latest(version)
        if isinstance(release, Rejected):
            return release
        script, script_lock = release.asset("slopsentral.py"), release.asset("slopsentral.py.lock")
    else:
        source = Path(__file__).resolve()
        script, script_lock = source.read_bytes(), Path(str(source) + ".lock").read_bytes()
    if isinstance(script, Rejected):
        return script
    if isinstance(script_lock, Rejected):
        return script_lock
    return script, script_lock


def publish_command(
    directory: Path, executable: Path, script: bytes, script_lock: bytes
) -> Result[dict[str, object]]:
    receipt = directory / "receipt.json"
    uv = shutil.which(os.environ.get("UV", "uv"))
    if uv is None:
        return Rejected(Reason.HOST_UNAVAILABLE, "uv")
    identity = hashlib.sha256(script + script_lock).hexdigest()
    bundle = directory / identity
    directory.mkdir(exist_ok=True)
    bundle.mkdir(exist_ok=True)
    atomic(bundle / "slopsentral.py", script)
    atomic(bundle / "slopsentral.py.lock", script_lock)
    launcher = f'#!/bin/sh\nexec {shlex.quote(uv)} run --locked --script {shlex.quote(str(bundle / "slopsentral.py"))} "$@"\n'
    files = {
        path.relative_to(directory).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in directory.rglob("*")
        if path.is_file() and path != receipt
    }
    atomic(receipt, json.dumps({"files": files, "launcher": launcher}).encode())
    atomic(executable, launcher.encode(), 0o755)
    return {
        "type": "INSTALLED",
        "command": str(executable),
        "sha256": identity,
        "path_hint": 'export PATH="$HOME/.local/bin:$PATH"',
    }


def locked_command(
    action: Action, version: str | None, directory: Path, executable: Path
) -> Result[dict[str, object]]:
    admitted = admit_command(directory, executable)
    if isinstance(admitted, Rejected):
        return admitted
    if action == "remove":
        if directory.exists():
            executable.unlink()
            shutil.rmtree(directory)
        return {"type": "REMOVED", "command": str(executable)}
    if action == "update" and not directory.exists():
        return Rejected(Reason.NOT_INSTALLED, "Install the command before an update.")
    source = command_source(action, version)
    if isinstance(source, Rejected):
        return source
    return publish_command(directory, executable, *source)


def native_marketplace(host: NativeHost) -> Result[Marketplace]:
    catalog = process([host, "plugin", "marketplace", "list", "--json"])
    if isinstance(catalog, Rejected):
        return catalog
    value = parse(catalog)
    sources = value.get("marketplaces") if mapping(value) else value
    if not sequence(sources) or not all(mapping(item) for item in sources):
        return Rejected(Reason.INVALID_RECORD, "Unknown marketplace list format.")
    selected = [item for item in sources if mapping(item) and item.get("name") == "slopsentral"]
    if len(selected) > 1:
        return Rejected(Reason.FOREIGN_SOURCE, "Ambiguous marketplace.")
    if selected:
        origin = (
            selected[0].get("marketplaceSource") if host == "codex" else selected[0].get("source")
        )
        source = origin.get("source") if mapping(origin) else origin
        if not isinstance(source, str) or source not in {
            f"https://github.com/{REPOSITORY}.git",
            f"https://github.com/{REPOSITORY}",
            f"GitHub: {REPOSITORY}",
        }:
            return Rejected(Reason.FOREIGN_SOURCE, "Existing slopsentral marketplace differs.")
    return Marketplace.REGISTERED if selected else Marketplace.ABSENT


@dataclass(frozen=True)
class InstalledPlugin:
    enabled: bool


def native_plugins(host: NativeHost) -> Result[dict[PluginName, InstalledPlugin]]:
    installed = process([host, "plugin", "list", "--json"])
    if isinstance(installed, Rejected):
        return installed
    value = parse(installed)
    rows = value.get("installed") if mapping(value) else value
    if not sequence(rows) or not all(mapping(item) for item in rows):
        return Rejected(Reason.INVALID_RECORD, "Unknown plugin list format.")
    own: dict[PluginName, InstalledPlugin] = {}
    for item in rows:
        if (
            not mapping(item)
            or item.get("marketplaceName" if host == "codex" else "marketplace") != "slopsentral"
        ):
            continue
        name, enabled = item.get("name"), item.get("enabled")
        if not isinstance(name, str) or not isinstance(enabled, bool):
            return Rejected(
                Reason.INVALID_RECORD, "Invalid installed plugin identity or enabled state."
            )
        try:
            plugin = PluginName(name)
        except ValueError:
            return Rejected(Reason.INVALID_RECORD, "Invalid installed plugin identity.")
        if plugin in own:
            return Rejected(Reason.INVALID_RECORD, "Duplicate installed plugin.")
        own[plugin] = InstalledPlugin(enabled)
    return own


def native_plan(
    action: Action,
    host: NativeHost,
    plugins: tuple[PluginName, ...],
    selected: Marketplace,
    own: dict[PluginName, InstalledPlugin],
) -> Result[list[list[str]]]:
    if not plugins:
        return []
    if action == "update" and any(plugin not in own for plugin in plugins):
        return Rejected(Reason.NOT_INSTALLED, "Update needs installed plugins.")
    if (
        action == "update"
        and host == "codex"
        and any(not own[plugin].enabled for plugin in plugins)
    ):
        return Rejected(
            Reason.PLUGIN_DISABLED,
            "Codex reinstall can enable a disabled plugin; no files changed.",
        )
    if selected is Marketplace.ABSENT and action != Action.INSTALL:
        return Rejected(Reason.NOT_INSTALLED, "Slopsentral marketplace is absent.")
    commands: list[list[str]] = []
    if selected is Marketplace.ABSENT:
        commands.append(
            [
                host,
                "plugin",
                "marketplace",
                "add",
                REPOSITORY,
                *(["--ref", "harness/codex", "--json"] if host == "codex" else []),
            ]
        )
    if action == "update":
        commands.append(
            [
                host,
                "plugin",
                "marketplace",
                "upgrade" if host == "codex" else "update",
                "slopsentral",
                *(["--json"] if host == "codex" else []),
            ]
        )
    for plugin in plugins:
        if (action == "install" and plugin in own) or (action == "remove" and plugin not in own):
            continue
        verb = "remove" if action == "remove" else "add"
        if host == "copilot":
            verb = {"install": "install", "update": "update", "remove": "uninstall"}[action]
        commands.append(
            [
                host,
                "plugin",
                verb,
                f"{plugin}@slopsentral",
                *(["--json"] if host == "codex" else []),
            ]
        )
    return commands


def native(action: Action, host: NativeHost, plugins: Selection) -> Result[dict[str, object]]:
    selected = native_marketplace(host)
    if isinstance(selected, Rejected):
        return selected
    own = native_plugins(host)
    if isinstance(own, Rejected):
        return own
    names = native_selection(action, plugins, own)
    if isinstance(names, Rejected):
        return names
    plugins = names
    commands = native_plan(action, host, plugins, selected, own)
    if isinstance(commands, Rejected):
        return commands
    for arguments in commands:
        result = process(arguments)
        if isinstance(result, Rejected):
            return result
    return {"type": "COMPLETED", "host": host, "action": action, "plugins": plugins}


def unpack(data: bytes, destination: Path) -> Result[Path]:
    try:
        decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
        expanded = decoder.decompress(data, MAX_BYTES + 1)
        if len(expanded) > MAX_BYTES or not decoder.eof or decoder.unused_data:
            return Rejected(Reason.UNSAFE_ARCHIVE, "Oversized or incomplete gzip stream.")
        with tarfile.open(fileobj=io.BytesIO(expanded), mode="r:") as archive:
            members = archive.getmembers()
            names = [member.name for member in members]
            if (
                len(set(names)) != len(names)
                or sum(member.size for member in members) > MAX_BYTES
                or any(
                    not member.name.startswith(".amp/plugins/")
                    or ".." in PurePosixPath(member.name).parts
                    or "\\" in member.name
                    or not (member.isfile() or member.isdir())
                    for member in members
                )
            ):
                return Rejected(Reason.UNSAFE_ARCHIVE, "Unexpected Amp archive members.")
            archive.extractall(destination, filter="data")
    except (tarfile.TarError, EOFError, zlib.error):
        return Rejected(Reason.UNSAFE_ARCHIVE, "Cannot read the Amp archive.")
    return destination / ".amp/plugins"


def same_tree(expected: Path, actual: Path) -> bool:
    if not actual.is_dir() or not direct(actual):
        return False
    paths = tuple(actual.rglob("*"))
    if any(not direct(path) or not (path.is_dir() or path.is_file()) for path in paths):
        return False
    expected_files = {
        p.relative_to(expected): p.read_bytes() for p in expected.rglob("*") if p.is_file()
    }
    actual_files = {p.relative_to(actual): p.read_bytes() for p in paths if p.is_file()}
    return expected_files == actual_files


def admit_amp_target(target: Path, cache: Path) -> Result[None]:
    if not target.is_symlink():
        return Rejected(Reason.OWNERSHIP_CONFLICT, str(target))
    source = target.readlink()
    digest = source.parent.name
    archive = cache / (digest + ".tar.gz")
    if (
        source != cache / digest / target.name
        or not re.fullmatch(r"[a-f0-9]{64}", digest)
        or not direct(archive)
        or not archive.is_file()
    ):
        return Rejected(Reason.OWNERSHIP_CONFLICT, str(target))
    data = archive.read_bytes()
    if hashlib.sha256(data).hexdigest() != digest:
        return Rejected(Reason.OWNERSHIP_CONFLICT, "Amp archive changed.")
    with tempfile.TemporaryDirectory(dir=cache) as temporary:
        expected = unpack(data, Path(temporary))
        if isinstance(expected, Rejected):
            return expected
        if not same_tree(expected, source.parent):
            return Rejected(Reason.OWNERSHIP_CONFLICT, "Installed Amp files changed.")
    return None


def admit_amp_links(action: Action, targets: tuple[Path, ...], cache: Path) -> Result[None]:
    for target in targets:
        if target.exists() or target.is_symlink():
            admitted = admit_amp_target(target, cache)
            if isinstance(admitted, Rejected):
                return admitted
        elif action == Action.UPDATE:
            return Rejected(Reason.NOT_INSTALLED, str(target))
    return None


def stage_amp(release: _Release, plugins: tuple[PluginName, ...], cache: Path) -> Result[Path]:
    data = release.asset("slopsentral-amp.tar.gz")
    if isinstance(data, Rejected):
        return data
    identity = hashlib.sha256(data).hexdigest()
    destination = cache / identity
    cache.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=cache) as temporary:
        extracted = unpack(data, Path(temporary))
        if isinstance(extracted, Rejected):
            return extracted
        if any(not (extracted / plugin / "index.js").is_file() for plugin in plugins):
            return Rejected(
                Reason.INVALID_RELEASE, "Selected plugin is absent from the Amp package."
            )
        if destination.exists():
            if not same_tree(extracted, destination):
                return Rejected(Reason.OWNERSHIP_CONFLICT, "Amp cache changed.")
        else:
            _ = extracted.rename(destination)
    archive = cache / (identity + ".tar.gz")
    if not direct(archive) or (archive.exists() and archive.read_bytes() != data):
        return Rejected(Reason.OWNERSHIP_CONFLICT, "Amp archive changed.")
    atomic(archive, data)
    return destination


def amp_selection(
    action: Action, plugins: Selection, version: str | None, root: Path, cache: Path
) -> Result[tuple[tuple[PluginName, ...], _Release | None]]:
    if not isinstance(plugins, AllPlugins):
        return plugins, None
    if action is Action.INSTALL:
        release = _Release.latest(version)
        if isinstance(release, Rejected):
            return release
        names = release_plugins(release)
        return names if isinstance(names, Rejected) else (names, release)
    installed_names: list[PluginName] = []
    for target in sorted(root.iterdir()) if root.exists() else ():
        if target.is_symlink() and target.readlink().parent.parent == cache:
            try:
                installed_names.append(PluginName(target.name))
            except ValueError:
                return Rejected(Reason.OWNERSHIP_CONFLICT, "Invalid managed Amp plugin identity.")
    return tuple(installed_names), None


def amp(action: Action, plugins: Selection, version: str | None) -> Result[dict[str, object]]:
    root = Path(os.environ.get("XDG_CONFIG_HOME", str(Path.home() / ".config"))) / "amp/plugins"
    cache = data_home() / "amp"
    if not direct(root) or not direct(cache):
        return Rejected(Reason.OWNERSHIP_CONFLICT, "Indirect Amp path.")
    selected = amp_selection(action, plugins, version, root, cache)
    if isinstance(selected, Rejected):
        return selected
    plugins, release = selected
    if not plugins:
        return {"type": "COMPLETED", "host": "amp", "action": action, "plugins": []}
    return amp_apply(action, plugins, version, (root, cache), release)


def amp_apply(
    action: Action,
    plugins: tuple[PluginName, ...],
    version: str | None,
    paths: tuple[Path, Path],
    release: _Release | None,
) -> Result[dict[str, object]]:
    root, cache = paths
    targets = tuple(root / plugin for plugin in plugins)
    admitted = admit_amp_links(action, targets, cache)
    if isinstance(admitted, Rejected):
        return admitted
    if action == "remove":
        for target in targets:
            target.unlink(missing_ok=True)
        return {"type": "REMOVED", "host": "amp", "plugins": plugins}
    if release is None:
        found = _Release.latest(version)
        if isinstance(found, Rejected):
            return found
        release = found
    destination = stage_amp(release, plugins, cache)
    if isinstance(destination, Rejected):
        return destination
    root.mkdir(parents=True, exist_ok=True)
    for target, plugin in zip(targets, plugins, strict=True):
        with tempfile.TemporaryDirectory(prefix=".slopsentral-", dir=root) as temporary:
            temporary_link = Path(temporary) / "plugin"
            temporary_link.symlink_to(destination / plugin)
            _ = temporary_link.replace(target)
    return {"type": "COMPLETED", "host": "amp", "version": release.version, "plugins": plugins}


def pi(action: Action, version: str | None) -> Result[dict[str, object]]:
    release = _Release.latest(version)
    if isinstance(release, Rejected):
        return release
    installer = release.asset("setup-pi.mts")
    if isinstance(installer, Rejected):
        return installer
    with tempfile.TemporaryDirectory(prefix="slopsentral-pi-") as temporary:
        script = Path(temporary) / "setup-pi.mts"
        _ = script.write_bytes(installer)
        result = process(
            [
                "node",
                str(script),
                "--version",
                release.version,
                *(["--remove"] if action == "remove" else []),
            ]
        )
    if isinstance(result, Rejected):
        return result
    _ = sys.stderr.buffer.write(result)
    return {"type": "COMPLETED", "host": "pi", "action": action, "version": release.version}


def identity(value: str) -> PluginName:
    try:
        return PluginName(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError(str(error)) from error


def version_number(value: str) -> str:
    if not VERSION.fullmatch(value):
        message = "Use a published X.Y.Z version."
        raise argparse.ArgumentTypeError(message)
    return value


def choose(
    title: str, rows: tuple[tuple[str, str], ...], *, multiple: bool = False
) -> Result[tuple[str, ...]]:
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        return Rejected(
            Reason.TERMINAL_REQUIRED,
            "Use an interactive terminal or explicit --host and --all options.",
        )
    executable = Path(sys.executable).parent / ("fzf.exe" if os.name == "nt" else "fzf")
    if not executable.is_file():
        return Rejected(
            Reason.SELECTOR_FAILED,
            "Start slopsentral through its locked uv launcher to supply fzf.",
        )
    environment = {key: value for key, value in os.environ.items() if not key.startswith("FZF_")}
    controls = "Tab select | Ctrl-A all | Ctrl-D none\n" if multiple else ""
    arguments = [
        str(executable),
        "--layout=reverse",
        "--height=80%",
        "--border=rounded",
        "--border-label= Slopsentral ",
        "--prompt=" + title + " > ",
        "--header=" + controls + "Enter accept | Esc cancel",
        "--delimiter=\t",
        "--with-nth=2..",
        "--no-sort",
        "--no-mouse",
        *(["--multi", "--bind=ctrl-a:select-all,ctrl-d:deselect-all"] if multiple else []),
        *(
            ["--no-color"]
            if "NO_COLOR" in environment
            else ["--color=border:blue,label:blue,prompt:cyan,pointer:cyan,marker:green"]
        ),
        *(["--no-unicode"] if environment.get("TERM") == "dumb" else []),
    ]
    result = subprocess.run(
        arguments,
        input="".join(key + "\t" + label + "\n" for key, label in rows),
        stdout=subprocess.PIPE,
        text=True,
        check=False,
        env=environment,
    )
    if result.returncode in {1, 130, -2}:
        return Rejected(Reason.CANCELLED, "No host operation started.")
    if result.returncode:
        return Rejected(Reason.SELECTOR_FAILED, f"fzf exited {result.returncode}.")
    selected = tuple(line.split("\t", 1)[0] for line in result.stdout.splitlines())
    if (
        not selected
        or len(set(selected)) != len(selected)
        or any(key not in dict(rows) for key in selected)
        or (not multiple and len(selected) != 1)
    ):
        return Rejected(Reason.SELECTOR_FAILED, "Invalid selector result.")
    return selected


def dispatch(
    action: Action, host: Host, plugins: Selection, version: str | None
) -> Result[dict[str, object]]:
    if host is Host.CODEX or host is Host.COPILOT:
        return native(action, host, plugins)
    if host is Host.AMP:
        return amp(action, plugins, version)
    return pi(action, version)


def setup(action: Action | None = None, version: str | None = None) -> Result[dict[str, object]]:
    if action is None:
        selected = choose(
            "Action",
            (("install", "Install all plugins"), ("update", "Update all installed plugins")),
        )
        if isinstance(selected, Rejected):
            return selected
        action = Action(selected[0])
    hosts = choose(
        "Harnesses",
        tuple(
            (host.value, host.value.title() + ("  [on PATH]" if shutil.which(host.value) else ""))
            for host in Host
        ),
        multiple=True,
    )
    if isinstance(hosts, Rejected):
        return hosts
    if version is not None and any(host in {"codex", "copilot"} for host in hosts):
        return Rejected(
            Reason.INVALID_RELEASE,
            "Codex and Copilot use their native marketplace channel; omit --version.",
        )
    accepted = choose(
        "Apply",
        (
            ("apply", f"{action.value.title()} all for {', '.join(hosts)}"),
            ("cancel", "Cancel without changes"),
        ),
    )
    if isinstance(accepted, Rejected):
        return accepted
    if accepted != ("apply",):
        return Rejected(Reason.CANCELLED, "No host operation started.")
    return apply_hosts(action, hosts, version)


def apply_hosts(
    action: Action, hosts: tuple[str, ...], version: str | None
) -> Result[dict[str, object]]:
    completed: list[dict[str, object]] = []
    for selected_host in hosts:
        print(f"{action.value}: {selected_host}", file=sys.stderr, flush=True)
        result = dispatch(action, Host(selected_host), AllPlugins.ALL, version)
        if isinstance(result, Rejected):
            print(
                f"Stopped at {selected_host}. Completed harnesses: {', '.join(hosts[: len(completed)]) or 'none'}.",
                file=sys.stderr,
            )
            return result
        completed.append(result)
    return {"type": "COMPLETED", "action": action, "hosts": completed}


def host_operation(
    parser: argparse.ArgumentParser, args: argparse.Namespace
) -> Result[dict[str, object]]:
    action = Action(args.action)
    all_plugins = getattr(args, "all", False) is True
    if args.host is None:
        if not all_plugins:
            parser.error("Use --host, or --all for interactive harness selection.")
        return setup(action, args.version)
    host = Host(args.host)
    plugins: Selection = AllPlugins.ALL if all_plugins else tuple(dict.fromkeys(args.plugin))
    if (host is Host.PI and args.plugin) or (host is not Host.PI and not plugins):
        parser.error("Pi uses its aggregate package; other hosts need --plugin or --all.")
    if host in {Host.CODEX, Host.COPILOT} and args.version is not None:
        parser.error("Codex and Copilot use their configured native marketplace channel.")
    return dispatch(action, host, plugins, args.version)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action")
    for action in ("install", "update", "remove"):
        operation = sub.add_parser(action)
        _ = operation.add_argument("--host", type=Host, choices=tuple(Host))
        selection = operation.add_mutually_exclusive_group()
        _ = selection.add_argument("--plugin", type=identity, action="append", default=[])
        if action != "remove":
            _ = selection.add_argument(
                "--all",
                action="store_true",
                help="Install the catalog or update installed Slopsentral plugins.",
            )
        _ = operation.add_argument("--version", type=version_number)
    _ = sub.add_parser("setup", help="Select a bulk action and harnesses interactively.")
    own = sub.add_parser("self", help="Install, update, or remove the executable command.")
    _ = own.add_argument("operation", type=Action, choices=tuple(Action))
    _ = own.add_argument("--version", type=version_number)
    args = parser.parse_args()
    try:
        if args.action in {None, "setup"}:
            result = setup()
        elif args.action == "self":
            if args.version is not None and args.operation != Action.UPDATE:
                parser.error("Only self update accepts --version.")
            result = command(Action(args.operation), args.version)
        else:
            result = host_operation(parser, args)
    except KeyboardInterrupt:
        result = Rejected(
            Reason.CANCELLED,
            "Operation interrupted; earlier completed host operations remain in effect.",
        )
    except OSError as error:
        result = Rejected(Reason.IO_FAILED, f"Filesystem operation failed: {error.strerror}")
    if isinstance(result, Rejected):
        print(
            json.dumps({"type": "REJECTED", "reason": result.reason.value, "detail": result.detail})
        )
        return 130 if result.reason is Reason.CANCELLED else 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
