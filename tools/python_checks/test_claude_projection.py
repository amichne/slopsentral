"""Exercise Claude's native plugin layout, discovery, and instruction hook."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def marketplace(tmp_path_factory: pytest.TempPathFactory) -> Path:
    supplied = os.environ.get("SLOPSENTRAL_CLAUDE_PROJECTION")
    if supplied:
        return Path(supplied)
    if not os.environ.get("PKL_BIN"):
        pytest.skip("requires pinned Pkl or a projected marketplace")
    out = tmp_path_factory.mktemp("claude projection") / "marketplace"
    _ = subprocess.run(
        [
            "python3",
            "tools/project_marketplaces.py",
            "--source",
            ".",
            "--harness",
            "claude",
            "--out",
            str(out),
        ],
        cwd=ROOT,
        check=True,
    )
    return out


def test_catalog_and_instruction_delivery(marketplace: Path) -> None:
    catalog = json.loads((marketplace / ".claude-plugin/marketplace.json").read_bytes())
    source = json.loads((ROOT / "source/adaptable.marketplace.json").read_bytes())
    assert [p["name"] for p in catalog["plugins"]] == [p["name"] for p in source["plugins"]]
    for entry in catalog["plugins"]:
        bundle = marketplace / entry["source"]
        name = entry["name"]
        original = json.loads((ROOT / "source/plugins" / name / "plugin.json").read_bytes())
        manifest = json.loads((bundle / ".claude-plugin/plugin.json").read_bytes())
        assert entry["source"] == "./plugins/" + name
        assert manifest["version"] == original["version"]
        assert manifest["name"] == name
        for agent in original["agents"]:
            authored = ROOT / "source" / agent["path"]
            assert (bundle / "agents" / authored.name).read_bytes() == authored.read_bytes()
        assert list(bundle.glob("skills/*/SKILL.md"))
        assert not list(bundle.glob("agents/*.toml"))
    bundle = marketplace / "plugins/software-engineering"
    hooks = json.loads((bundle / "hooks/hooks.json").read_bytes())["hooks"]
    assert set(hooks) == {"SessionStart"}
    command = hooks["SessionStart"][0]["hooks"][0]["command"]
    event = {"hook_event_name": "SessionStart", "source": "startup", "session_id": "fixture"}
    result = subprocess.run(
        ["sh", "-c", command],
        cwd=marketplace,
        env={**os.environ, "CLAUDE_PLUGIN_ROOT": str(bundle)},
        input=json.dumps(event),
        text=True,
        capture_output=True,
        check=True,
    )
    expected = "\n\n".join(
        (ROOT / "source/instructions" / f"{name}.md").read_text().strip()
        for name in ("agent-execution", "engineering-design")
    )
    assert json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"] == expected
    assert not (marketplace / "plugins/repository-knowledge/hooks/hooks.json").exists()


def test_native_install(marketplace: Path, tmp_path: Path) -> None:
    cli = shutil.which("claude")
    if cli is None:
        pytest.skip("Claude Code CLI unavailable")
    env = {
        **os.environ,
        "HOME": str(tmp_path),
        "CLAUDE_CONFIG_DIR": str(tmp_path / "claude"),
        "GIT_CONFIG_GLOBAL": str(tmp_path / ".gitconfig"),
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_ALLOW_PROTOCOL": "file",
        "GIT_TERMINAL_PROMPT": "0",
    }
    remote = tmp_path / "origin.git"
    repo = tmp_path / "source"
    release_url = "https://github.com/amichne/slopsentral.git"

    def execute(cwd: Path, *args: str) -> str:
        return subprocess.run(
            args, cwd=cwd, env=env, check=True, text=True, capture_output=True
        ).stdout.strip()

    _ = execute(tmp_path, "git", "init", "-q", "--bare", str(remote))
    _ = execute(tmp_path, "git", "init", "-q", "-b", "main", str(repo))
    _ = execute(
        repo,
        "git",
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.org",
        "commit",
        "--allow-empty",
        "-qm",
        "source",
    )
    _ = execute(repo, "git", "remote", "add", "origin", str(remote))
    _ = execute(repo, "git", "push", "-q", "origin", "main")
    revision = execute(repo, "git", "rev-parse", "HEAD")
    _ = execute(
        repo,
        "python3",
        str(ROOT / "tools/publish.py"),
        "harness",
        str(marketplace),
        "harness/claude",
        "main",
        revision,
    )
    assert (
        execute(
            remote,
            "git",
            "log",
            "-1",
            "--format=%(trailers:key=Source-Commit,valueonly)",
            "harness/claude",
        )
        == revision
    )
    _ = execute(repo, "git", "config", "--global", f"url.{remote.as_uri()}.insteadOf", release_url)

    def run(*args: str) -> str:
        return execute(tmp_path, cli, "plugin", *args)

    _ = run("validate", str(marketplace), "--strict")
    _ = run("marketplace", "add", release_url + "#harness/claude")
    expected: set[str] = set()
    for bundle in sorted((marketplace / "plugins").iterdir()):
        _ = run("validate", str(bundle), "--strict")
        plugin = bundle.name + "@slopsentral"
        _ = run("install", plugin)
        expected.add(plugin)
    installed = json.loads(run("list", "--json"))
    active = {p["id"] for p in installed if p["enabled"] and p["id"].endswith("@slopsentral")}
    assert active == expected
