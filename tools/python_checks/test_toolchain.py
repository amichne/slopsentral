from __future__ import annotations

import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import threading
import zipfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from typing import TYPE_CHECKING

import pytest

from tools import toolchain

if TYPE_CHECKING:
    from pathlib import Path

BINARY = b"#!/bin/sh\necho fixture\n"
DIGEST = hashlib.sha256(BINARY).hexdigest()


def fixture(**overrides: str) -> str:
    asset = {
        "url": "https://github.com/o/r/releases/download/1/pkl",
        "sha256": DIGEST,
        "format": "binary",
        "executable": "pkl",
        **overrides,
    }
    tools = {
        "pkl": {
            "version": "1.0.0",
            "profiles": ["core"],
            "environment": "PKL_BIN",
            "archiveEnvironment": "PKL_ARCHIVE",
            "assets": {"linux-x64": asset},
        },
        "kotlin": {
            "version": "2.0.0",
            "profiles": ["ci"],
            "assets": {"any": asset},
        },
    }
    return json.dumps({"schemaVersion": 1, "tools": tools})


def selection(cache: Path, host: str = "linux-x64", profile: str = "core") -> list[toolchain.Entry]:
    manifest = toolchain.load_manifest(fixture())
    assert isinstance(manifest, dict)
    result = toolchain.entries(manifest, [], profile, host, cache)
    assert isinstance(result, list)
    return result


def write_binary(_url: str, path: Path) -> None:
    _ = path.write_bytes(BINARY)


def test_project_pins_match_all_bootstraps() -> None:
    manifest = toolchain.load_manifest(toolchain.MANIFEST.read_text())
    assert isinstance(manifest, dict)
    assert set(manifest) == {"gum", "kotlin", "pkl", "uv", "vale", "worktrunk"}
    for name in ("gum", "uv", "pkl", "vale"):
        assert "core" in manifest[name].profiles
        assert set(manifest[name].assets) == {
            "darwin-arm64",
            "darwin-x64",
            "linux-x64",
            "linux-arm64",
        }
    uv = manifest["uv"]
    assert 'required-version = ">=0.12.9"' in (toolchain.ROOT / "uv.toml").read_text()
    installer = (toolchain.ROOT / "install.sh").read_text()
    assert set(re.findall(r"astral\.sh/uv/([\d.]+)/", installer)) == {uv.version}
    pi = (toolchain.ROOT / "tools/setup-pi.mts").read_text()
    assert set(re.findall(r"astral-sh/uv/releases/download/([\d.]+)/", pi)) == {uv.version}
    for host, asset in uv.assets.items():
        assert re.search(rf"'{host}': \['[^']+', '{asset.sha256}'\]", pi)


@pytest.mark.parametrize(
    "overrides",
    [
        {"url": "http://example.invalid/x"},
        {"sha256": "short"},
        {"format": "rpm"},
        {"executable": "../escape"},
    ],
)
def test_invalid_manifest(overrides: dict[str, str]) -> None:
    assert toolchain.load_manifest(fixture(**overrides)) == toolchain.Failure("INVALID_MANIFEST")


def test_boolean_is_not_a_schema_version() -> None:
    assert toolchain.load_manifest('{"schemaVersion": true, "tools": {}}') == toolchain.Failure(
        "INVALID_MANIFEST"
    )


def test_platform_and_profiles(tmp_path: Path) -> None:
    assert [item.name for item in selection(tmp_path)] == ["pkl"]
    assert [item.name for item in selection(tmp_path, "darwin-arm64", "ci")] == ["kotlin"]
    assert selection(tmp_path, "darwin-arm64") == []
    manifest = toolchain.load_manifest(fixture())
    assert isinstance(manifest, dict)
    rejected = toolchain.entries(manifest, ["pkl"], "core", "plan9-mips", tmp_path)
    assert rejected == toolchain.Failure("UNSUPPORTED_PLATFORM", "pkl on plan9-mips")


def test_fetch_rejects_digest_before_publication(tmp_path: Path) -> None:
    def corrupt(_url: str, path: Path) -> None:
        _ = path.write_bytes(b"corrupt")

    (entry,) = selection(tmp_path)
    assert toolchain.fetch(entry, corrupt) == toolchain.Failure("DIGEST_MISMATCH", "pkl")
    assert list(tmp_path.iterdir()) == []


def test_concurrent_fetch_keeps_one_complete_cache_entry(tmp_path: Path) -> None:
    (entry,) = selection(tmp_path)
    barrier = threading.Barrier(2)

    def download(url: str, path: Path) -> None:
        _ = barrier.wait(timeout=10)
        write_binary(url, path)

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(toolchain.fetch, entry, download) for _ in range(2)]
        assert [result.result() for result in futures] == [None, None]
    assert list(tmp_path.iterdir()) == [entry.directory]
    assert entry.directory.name == f"pkl-1.0.0-{DIGEST[:16]}"
    assert entry.executable.read_bytes() == entry.archive.read_bytes() == BINARY
    assert os.access(entry.executable, os.X_OK)

    def offline(_url: str, _destination: Path) -> None:
        pytest.fail("network used for a cache hit")

    assert toolchain.fetch(entry, offline) is None


@pytest.mark.parametrize("fmt", ["zip", "tar.xz", "tar.gz"])
def test_fetch_archive_includes_sibling_executables(fmt: str, tmp_path: Path) -> None:
    source = tmp_path / "release"
    files = ["bin/pkl", "bin/sibling"]
    if fmt == "zip":
        with zipfile.ZipFile(source, "w") as archive:
            for file in files:
                archive.writestr(file, BINARY)
    else:
        with tarfile.open(source, "w:gz" if fmt == "tar.gz" else "w:xz") as archive:
            for file in files:
                header = tarfile.TarInfo(file)
                header.size = len(BINARY)
                archive.addfile(header, io.BytesIO(BINARY))
    (old,) = selection(tmp_path)
    asset = replace(
        old.asset, sha256=toolchain.file_sha256(source), executable=files[0], format=fmt
    )
    entry = replace(old, asset=asset)

    def download(_url: str, path: Path) -> None:
        _ = shutil.copyfile(source, path)

    assert toolchain.fetch(entry, download) is None
    for file in files:
        executable = entry.directory / "root" / file
        assert executable.read_bytes() == BINARY
        assert os.access(executable, os.X_OK)


def test_cli_uses_checkout_manifest_cache_and_child_environment(tmp_path: Path) -> None:
    root = tmp_path / "checkout with spaces"
    scripts = root / "tools"
    scripts.mkdir(parents=True)
    _ = shutil.copyfile(toolchain.ROOT / "tools/toolchain.py", scripts / "toolchain.py")
    _ = (scripts / "toolchain.json").write_text(
        fixture().replace("linux-x64", toolchain.current_platform())
    )
    cache = tmp_path / "cache ; $"
    (entry,) = selection(cache)
    env = {**os.environ, "SLOPSENTRAL_TOOLCHAIN_CACHE": str(cache), "PKL_BIN": "/explicit/pkl"}

    def cli(*args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(scripts / "toolchain.py"), *args],
            cwd=tmp_path,
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )

    missing = cli("path", "pkl")
    assert missing.returncode == 69
    assert json.loads(missing.stderr)["reason"] == "NOT_FETCHED"
    invalid = cli("install")
    assert invalid.returncode == 2
    assert json.loads(invalid.stderr)["reason"] == "INVALID_INVOCATION"
    assert toolchain.fetch(entry, write_binary) is None
    assert json.loads(cli("fetch", "pkl").stdout)["type"] == "TOOL_READY"
    assert cli("path", "pkl").stdout.strip() == str(entry.executable)
    assert cli("env").stdout.splitlines() == [
        f"PKL_BIN={entry.executable}",
        f"PKL_ARCHIVE={entry.archive}",
    ]
    assert cli("paths").stdout.splitlines() == [str(root / "bin"), str(entry.executable.parent)]
    selected = "import os,json; print(json.dumps({k: os.environ[k] for k in ('PKL_BIN','PATH')}))"
    child = cli("run", "--", sys.executable, "-c", selected)
    assert child.returncode == 0
    child_env = json.loads(child.stdout)
    assert child_env["PKL_BIN"] == "/explicit/pkl"
    assert child_env["PATH"].split(os.pathsep)[:2] == [
        str(root / "bin"),
        str(entry.executable.parent),
    ]
    env["PKL_BIN"] = ""
    assert json.loads(cli("run", "--", sys.executable, "-c", selected).stdout)["PKL_BIN"] == str(
        entry.executable
    )
    assert cli("run", "--", sys.executable, "-c", "raise SystemExit(17)").returncode == 17
