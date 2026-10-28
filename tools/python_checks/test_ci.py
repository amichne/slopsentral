from __future__ import annotations

import os
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
from typing import TYPE_CHECKING, override

import pytest

from tools import ci

if TYPE_CHECKING:
    from pathlib import Path


@pytest.mark.parametrize("registry_status", [HTTPStatus.NOT_FOUND, HTTPStatus.FORBIDDEN])
def test_native_pkl_ci_uses_no_public_registry(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    registry_status: HTTPStatus,
) -> None:
    native = os.environ.get("PKL_BIN")
    if native is None:
        pytest.skip("PKL_BIN selects the native Pkl executable")
    requests: list[str] = []
    registry_requests: list[str] = []

    class Registry(ci.UnpublishedPackage):
        @override
        def do_GET(self) -> None:
            registry_requests.append(self.path)
            self.send_error(registry_status)

    monkeypatch.setattr(ci, "UnpublishedPackage", Registry)

    class DeniedProxy(BaseHTTPRequestHandler):
        def do_CONNECT(self) -> None:
            requests.append(self.path)
            self.send_error(HTTPStatus.FORBIDDEN)

        @override
        def log_message(self, format: str, *args: object) -> None:
            del format, args

    with HTTPServer(("127.0.0.1", 0), DeniedProxy) as proxy:
        worker = Thread(target=proxy.serve_forever, daemon=True)
        worker.start()
        try:
            wrapper = tmp_path / "pkl"
            _ = wrapper.write_text(
                f"#!{sys.executable}\n"
                "import os, sys\n"
                "args = sys.argv[1:]\n"
                "if args[:2] == ['project', 'package']:\n"
                f"    args += ['--http-proxy=http://127.0.0.1:{proxy.server_port}', '--http-no-proxy=127.0.0.1']\n"
                f"os.execv({native!r}, [{native!r}, *args])\n"
            )
            wrapper.chmod(0o700)
            monkeypatch.setenv("PKL_BIN", str(wrapper))
            original = ci.commands

            def commands(
                items: tuple[tuple[str, ...], ...],
                *,
                env: dict[str, str] | None = None,
            ) -> int:
                # TOON decoding does not participate in package qualification.
                return 0 if items[0][0] == "npx" else original(items, env=env)

            monkeypatch.setattr(ci, "commands", commands)
            assert ci.pkl_smoke(tmp_path) == (0 if registry_status == HTTPStatus.NOT_FOUND else 1)
            assert requests == []
            assert "/pkl-agent-fixture@1.0.0" in registry_requests
            assert set(registry_requests) <= {
                "/pkl-agent-fixture@1.0.0",
                "/pkl-agent-fixture@1.0.0.zip",
            }
        finally:
            proxy.shutdown()
            worker.join()
