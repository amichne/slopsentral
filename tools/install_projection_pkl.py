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
"""Install the checksum-pinned Pkl executable without Node.js."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

from marketplace import ProjectionError, obj, string


def install(target: Path) -> dict[str, str]:
    if target.exists() or target.is_symlink():
        return {"type": "PKL_INSTALL_REJECTED", "reason": "INVALID_DESTINATION"}
    lock = obj(json.loads((Path(__file__).parent / "projection/pkl-runtime.json").read_text()))
    host = {"Darwin": "darwin", "Linux": "linux"}.get(platform.system())
    arch = {"arm64": "arm64", "aarch64": "arm64", "x86_64": "x64", "AMD64": "x64"}.get(
        platform.machine()
    )
    asset = obj(lock["assets"]).get(f"{host}-{arch}")
    if asset is None:
        return {"type": "PKL_INSTALL_REJECTED", "reason": "UNSUPPORTED_PLATFORM"}
    metadata = obj(asset)
    url = f"https://github.com/{string(lock['repository'])}/releases/download/{string(lock['version'])}/{string(metadata['name'])}"
    with urllib.request.urlopen(url, timeout=120) as response:  # noqa: S310 -- fixed HTTPS release origin
        data = response.read()
    if hashlib.sha256(data).hexdigest() != string(metadata["sha256"]):
        return {"type": "PKL_INSTALL_REJECTED", "reason": "DIGEST_MISMATCH"}
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".projection-pkl-", dir=target.parent) as temporary:
        staged = Path(temporary) / "pkl"
        _ = staged.write_bytes(data)
        staged.chmod(0o755)
        os.link(staged, target)
    return {
        "type": "PKL_INSTALLED",
        "version": string(lock["version"]),
        "sha256": string(metadata["sha256"]),
        "out": str(target),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("--out", required=True, type=Path)
    arguments = parser.parse_args()
    try:
        result = install(Path(arguments.out).absolute())
    except (OSError, urllib.error.URLError, ValueError, ProjectionError):
        result = {"type": "PKL_INSTALL_REJECTED", "reason": "EFFECT_FAILED"}
    print(json.dumps(result))
    return 0 if result["type"] == "PKL_INSTALLED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
