"""Acceptance evidence for the distributable local Vale setup."""

import json
import os
import shutil
import subprocess
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import TypeGuard

import pytest

import install_vale as installer

SKILL = Path(__file__).resolve().parents[2]


def test_skill_supplies_a_local_vale_setup() -> None:
    assert (SKILL / "scripts/install_vale.py").is_file(), (
        "The skill supplies no installer for the local Vale CLI."
    )
    assert (SKILL / "assets/vale/.vale.ini").is_file(), "The skill supplies no Vale configuration."


@pytest.mark.parametrize(
    ("system", "machine", "name"),
    [
        ("Darwin", "arm64", "macOS_arm64.tar.gz"),
        ("Darwin", "x86_64", "macOS_64-bit.tar.gz"),
        ("Linux", "aarch64", "Linux_arm64.tar.gz"),
        ("Linux", "x86_64", "Linux_64-bit.tar.gz"),
        ("Windows", "ARM64", "Windows_arm64.zip"),
        ("Windows", "AMD64", "Windows_64-bit.zip"),
    ],
)
def test_platform_selects_a_pinned_release(system: str, machine: str, name: str) -> None:
    release = installer.select_release(system, machine)
    assert not isinstance(release, installer.Failure)
    assert release.name == f"vale_3.24.0_{name}"


def test_unknown_platform_fails_closed() -> None:
    assert installer.select_release("Linux", "riscv64") == installer.Failure(
        installer.FailureCode.UNSUPPORTED_PLATFORM
    )


@pytest.mark.parametrize(
    "url",
    [
        "https://vale.sh/cms",
        "https://docs.vale.sh/mcp",
        "http://github.com/vale-cli/vale",
        "https://github.com.evil.example/vale",
        "https://github.com@evil.example/vale",
        "https://github.com:8443/vale",
        "file:///tmp/archive",
        "https://[invalid-host/archive",
    ],
)
def test_download_policy_rejects_non_artifact_endpoints(url: str) -> None:
    assert not installer.allowed_download(url)


def test_download_policy_allows_github_artifact_redirects() -> None:
    assert installer.allowed_download("https://release-assets.githubusercontent.com/file?sig=123")


def test_rejected_destination_never_downloads(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def forbidden_download(release: object) -> bytes:
        pytest.fail("The installer downloaded after it rejected the destination.")

    monkeypatch.setattr(installer, "download", forbidden_download)
    assert installer.setup(tmp_path, None) == installer.Failure(
        installer.FailureCode.DESTINATION_EXISTS
    )


@pytest.mark.parametrize("damage", ["changed", "extra", "duplicate", "traversal", "boolean"])
def test_bundle_rejects_policy_drift(tmp_path: Path, damage: str) -> None:
    bundle = tmp_path / "bundle"
    shutil.copytree(SKILL / "assets/vale", bundle)
    lock = bundle / "resources.lock.json"
    text = lock.read_text()
    if damage == "changed":
        (bundle / ".vale.ini").write_text("Packages = Microsoft\n")
    elif damage == "extra":
        (bundle / "styles/untracked.yml").write_text("extends: existence\n")
    elif damage == "duplicate":
        lock.write_text(
            text.replace('"schemaVersion": 1', '"schemaVersion": 1, "schemaVersion": 1')
        )
    elif damage == "traversal":
        lock.write_text(text.replace('".vale.ini":', '"../.vale.ini":'))
    elif damage == "boolean":
        lock.write_text(text.replace('"schemaVersion": 1', '"schemaVersion": true'))
    assert installer.load_bundle(bundle) == installer.Failure(installer.FailureCode.INVALID_BUNDLE)


def test_config_has_no_remote_resolution() -> None:
    config = (SKILL / "assets/vale/.vale.ini").read_text()
    assert "Packages" not in config
    assert "https://" not in config
    assert "http://" not in config
    assert not list((SKILL / "assets/vale").rglob(".mcp.json"))


@pytest.fixture(scope="module")
def archive_path() -> Path:
    supplied = os.environ.get("TEST_VALE_ARCHIVE")
    if supplied is None:
        pytest.skip("Set TEST_VALE_ARCHIVE to the pinned archive for real CLI evidence.")
    path = Path(supplied)
    assert path.is_file()
    return path


@pytest.fixture(scope="module")
def installed(tmp_path_factory: pytest.TempPathFactory, archive_path: Path) -> installer.Installed:
    destination = tmp_path_factory.mktemp("vale") / "literal $(name); with spaces"
    outcome = installer.setup(destination, archive_path)
    assert isinstance(outcome, installer.Installed), outcome
    return outcome


def _is_mapping(value: object) -> TypeGuard[Mapping[object, object]]:
    return isinstance(value, Mapping)


def _is_list(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def lint(installed: installer.Installed, path: str, text: str) -> tuple[int, set[str]]:
    result = subprocess.run(
        [
            str(installed.executable),
            "--no-global",
            f"--config={installed.destination / '.vale.ini'}",
            "--output=JSON",
            f"--path={path}",
        ],
        input=text,
        text=True,
        capture_output=True,
        check=False,
        timeout=30,
    )
    assert result.returncode in {0, 1}, result.stderr
    payload: object = json.loads(result.stdout)
    assert _is_mapping(payload)
    checks: set[str] = set()
    for alerts in payload.values():
        assert _is_list(alerts)
        for alert in alerts:
            assert _is_mapping(alert)
            check = alert["Check"]
            assert isinstance(check, str)
            checks.add(check)
    return result.returncode, checks


def test_archive_mismatch_has_no_install_effect(tmp_path: Path, archive_path: Path) -> None:
    damaged = tmp_path / "damaged.tar.gz"
    raw = archive_path.read_bytes()
    damaged.write_bytes(raw[:-1] + bytes([raw[-1] ^ 1]))
    destination = tmp_path / "install"
    assert installer.setup(destination, damaged) == installer.Failure(
        installer.FailureCode.DIGEST_MISMATCH
    )
    assert not destination.exists()


def test_valid_commit_ignores_git_comments_trailers_and_code(
    installed: installer.Installed,
) -> None:
    assert lint(
        installed,
        "COMMIT_EDITMSG",
        "feat: add local prose rules\n\nUse `utilize()` in the example.\n\n"
        "Signed-off-by: Some Name <name@example.com>\n# Utilize the template.\n",
    ) == (0, set())


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("feat: add local rules.\n", "Slopsentral.CommitPeriod"),
        ("feat: add local rules\nThe body starts here.\n", "Commits.Blank"),
        ("Add local rules\n", "Conventional.Type"),
        ("feat: " + "a" * 73 + "\n", "Slopsentral.CommitLength"),
        ("feat: Added local rules\n", "Commits.Imperative"),
    ],
)
def test_commit_findings_reach_the_real_cli(
    installed: installer.Installed, text: str, expected: str
) -> None:
    _, checks = lint(installed, "COMMIT_EDITMSG", text)
    assert expected in checks


@pytest.mark.parametrize(
    ("path", "valid", "invalid", "expected"),
    [
        (
            "docs/tutorials/nested/start.md",
            "# Start a site\n\nIn this tutorial, we will make a site.\n\n"
            "1. Create the file.\n2. Open the page.\n\nYou will see the page.\n",
            "# Start a site\n\nThe server has features.\n",
            "Tutorial.Steps",
        ),
        (
            "docs/how-to/nested/start.md",
            "# How to start the tool\n\nThis guide shows you how to start the tool.\n\n"
            "1. Open the page.\n",
            "# Start\n\nThe server has features.\n",
            "HowTo.Steps",
        ),
        (
            "docs/reference/nested/port.md",
            "# Port\n\nThe port is 8080.\n\n```text\nport = 8080\n```\n",
            "# Port\n\nYou should choose a port.\n",
            "Reference.Instruction",
        ),
        (
            "docs/explanation/nested/cache.md",
            "# Cache\n\nThe cache keeps files because reads take time.\n",
            "# Cache\n\n1. Run the tool.\n",
            "Explanation.Instruction",
        ),
    ],
)
def test_document_type_routes_nested_paths(
    installed: installer.Installed, path: str, valid: str, invalid: str, expected: str
) -> None:
    assert lint(installed, path, valid) == (0, set())
    _, checks = lint(installed, path, invalid)
    assert expected in checks


@pytest.mark.parametrize(
    "path", ["tutorials/start.md", "docs/tutorials/start.md", "docs/tutorials/start.mdx"]
)
def test_tutorial_type_also_routes_direct_paths(installed: installer.Installed, path: str) -> None:
    _, checks = lint(installed, path, "# Start\n\nThe server has features.\n")
    assert "Tutorial.Steps" in checks


def test_explicit_config_ignores_global_policy(
    installed: installer.Installed, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
    (tmp_path / ".vale.ini").write_text("[*]\nBasedOnStyles = DoesNotExist\n")
    assert lint(installed, "review-comment.md", "Use the file.\n") == (0, set())


def test_review_comment_uses_plain_rules_and_keeps_code(installed: installer.Installed) -> None:
    assert lint(installed, "review-comment.md", "Use `utilize()` here.\n") == (0, set())
    _, checks = lint(installed, "review-comment.md", "Utilize the file.\n")
    assert "Slopsentral.Diction" in checks
    assert not any(
        check.startswith(("Tutorial.", "HowTo.", "Reference.", "Explanation.")) for check in checks
    )


def test_list_advisory_counts_each_sentence(installed: installer.Installed) -> None:
    prefix = "# How to start\n\nThis guide shows you how to start the tool.\n\n"
    words = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen"
    _, accepted = lint(installed, "docs/how-to/start.md", prefix + f"1. Write {words}.\n")
    _, rejected = lint(installed, "docs/how-to/start.md", prefix + f"1. Write {words} twenty.\n")
    assert "Slopsentral.ProcedureLength" not in accepted
    assert "Slopsentral.ProcedureLength" in rejected
    _, multiple = lint(
        installed, "docs/how-to/start.md", prefix + "1. Create the file. Open the page.\n"
    )
    assert "Slopsentral.ProcedureLength" not in multiple


def test_offline_install_and_lint_under_network_denial(tmp_path: Path, archive_path: Path) -> None:
    sandbox = Path("/usr/bin/sandbox-exec")
    if not sandbox.is_file():
        pytest.skip("The network-denial oracle uses the macOS sandbox.")
    profile = "(version 1) (allow default) (deny network*)"
    probe = subprocess.run(
        [
            str(sandbox),
            "-p",
            profile,
            sys.executable,
            "-c",
            "import socket; socket.create_connection(('127.0.0.1', 9), timeout=1)",
        ],
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    assert probe.returncode != 0 and "Operation not permitted" in probe.stderr
    destination = tmp_path / "offline"
    result = subprocess.run(
        [
            str(sandbox),
            "-p",
            profile,
            sys.executable,
            str(SKILL / "scripts/install_vale.py"),
            "--destination",
            str(destination),
            "--archive",
            str(archive_path),
        ],
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    lint_result = subprocess.run(
        [
            str(sandbox),
            "-p",
            profile,
            str(destination / "bin/vale"),
            "--no-global",
            f"--config={destination / '.vale.ini'}",
            "--path=docs/explanation/cache.md",
            "--output=JSON",
        ],
        input="# Cache\n\nThe cache keeps files because reads take time.\n",
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    assert lint_result.returncode == 0 and json.loads(lint_result.stdout) == {}
