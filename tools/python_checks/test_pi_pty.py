from __future__ import annotations

import fcntl
import json
import os
import pty
import re
import select
import shutil
import signal
import struct
import subprocess
import termios
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from collections.abc import Iterator

ROOT = Path(__file__).resolve().parents[2]
ANSI = re.compile(rb"\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))")


def fixture_package(tmp_path: Path) -> Path:
    package = tmp_path / "package"
    extensions = package / "extensions"
    extensions.mkdir(parents=True)
    for source in (ROOT / "source/hooks/pi").glob("*.ts"):
        _ = shutil.copyfile(source, extensions / source.name)
    _ = (package / "package.json").write_text(
        json.dumps(
            {
                "type": "module",
                "pi": {"extensions": ["./extensions/slopsentral.ts"], "skills": []},
            }
        )
    )
    _ = (package / "profiles.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "defaultProfile": "fixture",
                "profiles": [
                    {
                        "name": "fixture",
                        "description": "PTY fixture",
                        "skills": [],
                        "instructions": [],
                        "agents": [],
                        "hooks": [],
                        "hookPolicy": "ADVISORY",
                    }
                ],
            }
        )
    )
    return package


@dataclass
class Terminal:
    master: int
    process: subprocess.Popen[bytes]
    transcript: bytearray

    def send(self, data: bytes) -> None:
        self.transcript.clear()
        _ = os.write(self.master, data)

    def read_until(self, expected: bytes) -> None:
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if expected in self.transcript or expected in ANSI.sub(b"", self.transcript):
                return
            assert self.process.poll() is None, bytes(self.transcript).decode(errors="replace")
            ready, _, _ = select.select([self.master], [], [], 0.1)
            if ready:
                chunk = os.read(self.master, 65536)
                self.transcript.extend(chunk)
                if b"\x1b[6n" in chunk:
                    _ = os.write(self.master, b"\x1b[1;1R")
        pytest.fail(bytes(self.transcript).decode(errors="replace"))


@contextmanager
def pi_terminal(tmp_path: Path, package: Path, session_file: Path) -> Iterator[Terminal]:
    node = shutil.which("node")
    assert node is not None
    cli = ROOT / "node_modules/@earendil-works/pi-coding-agent/dist/cli.js"
    assert cli.is_file(), "Run npm ci --ignore-scripts before the PTY case."
    master, slave = pty.openpty()
    _ = fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 24, 80, 0, 0))
    environment = {
        **os.environ,
        "PI_CODING_AGENT_DIR": str(tmp_path / "agent"),
        "PI_OFFLINE": "1",
        "TERM": "xterm-256color",
        "NO_COLOR": "1",
    }
    process = subprocess.Popen(
        [
            node,
            str(cli),
            "--offline",
            "--no-extensions",
            "--no-skills",
            "--no-prompt-templates",
            "--no-themes",
            "--session",
            str(session_file),
            "-e",
            str(package),
        ],
        cwd=tmp_path,
        env=environment,
        stdin=slave,
        stdout=slave,
        stderr=slave,
        start_new_session=True,
    )
    os.close(slave)
    try:
        yield Terminal(master, process, bytearray())
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
        try:
            _ = process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            _ = process.wait(timeout=3)
        os.close(master)


def test_real_pi_menu_and_editor_focus(tmp_path: Path) -> None:
    package = fixture_package(tmp_path)
    session_file = tmp_path / "session.jsonl"
    # Pi persists entries immediately when it opens an explicitly existing empty session.
    session_file.touch()
    with pi_terminal(tmp_path, package, session_file) as terminal:
        terminal.read_until(b"Slopsentral:")
        terminal.send(b"\x1b[200~/slopsentral\x1b[201~")
        terminal.read_until(b"/slopsentral")
        terminal.send(b"\r")
        terminal.read_until(b"Save scope")
        terminal.send(b"\r")
        terminal.read_until(b"Search")
        terminal.send(b"none")
        terminal.read_until(b"none")
        terminal.send(b"\r")
        terminal.read_until(b"Saved to session")
        terminal.send(b"\x1b")
        terminal.read_until("─".encode())
        terminal.send(b"\x1b[200~focus-restored\x1b[201~")
        terminal.read_until(b"focus-restored")
        terminal.send(b"\x15")
        terminal.read_until(b"\x1b[2K")
        terminal.send(b"\x1b[200~/slopsentral state\x1b[201~")
        terminal.read_until(b"/slopsentral state")
        terminal.send(b"\r")
        terminal.read_until(b'"effective"')
        entries = [json.loads(line) for line in session_file.read_text().splitlines()]
        assert any(
            entry.get("customType") == "slopsentral-profile" and entry.get("data") == "none"
            for entry in entries
        )
