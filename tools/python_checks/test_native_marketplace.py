"""Exercise Pkl composition and the host adapter without a Node executable."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from tools.marketplace import Code, ProjectionError, array, obj, project, snapshot, source_input

ROOT = Path(__file__).resolve().parents[2]
PKL = os.environ.get("PKL_BIN")
pytestmark = pytest.mark.skipif(not PKL, reason="PKL_BIN must select Pkl 0.32.0")


@pytest.fixture
def source(tmp_path: Path) -> Path:
    repository = tmp_path / "repository with spaces;literal"
    _ = shutil.copytree(
        ROOT / "source",
        repository / "source",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    _ = subprocess.run(["git", "init", "--quiet", str(repository)], check=True)
    _ = subprocess.run(
        [
            "git",
            "-C",
            str(repository),
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "-c",
            "core.hooksPath=/dev/null",
            "commit",
            "--allow-empty",
            "--no-gpg-sign",
            "--quiet",
            "-m",
            "fixture",
        ],
        check=True,
    )
    return repository


def change(repository: Path, name: str, field: str, value: object) -> None:
    file = repository / name
    payload = obj(json.loads(file.read_text()))
    payload[field] = value
    _ = file.write_text(json.dumps(payload))


@pytest.mark.parametrize(
    ("field", "value", "reason"),
    [
        ("hookPolicy", {"type": "HOOK_POLICY", "mode": "ENFORCING"}, "LIFECYCLE_HOOKS"),
        ("hookPolicy", {"type": "HOOK_POLICY", "mode": "ADVISORY"}, "LIFECYCLE_HOOKS"),
        ("skills", {"skill:semantic-ratchet": {"invocation": "model"}}, "INVOCATION_RESTRICTION"),
        ("skills", {"skill:semantic-ratchet": {"invocation": "human"}}, "INVOCATION_RESTRICTION"),
    ],
)
def test_content_profile_rejects_unproved_capabilities(
    source: Path, tmp_path: Path, field: str, value: object, reason: str
) -> None:
    assert PKL
    change(source, "source/profiles/kotlin-type-design.json", field, value)
    out = tmp_path / "rejected"
    with pytest.raises(ProjectionError, match=reason) as error:
        _ = project(source, "pi", out, PKL, profile="kotlin-type-design")
    assert error.value.code == Code.UNSUPPORTED_CAPABILITY
    assert not out.exists()


@pytest.mark.parametrize("harness", ["codex", "github-copilot"])
def test_content_profile_rejects_other_hosts(source: Path, tmp_path: Path, harness: str) -> None:
    assert PKL
    out = tmp_path / "rejected"
    with pytest.raises(ProjectionError, match="CONTENT_PROFILE_TARGET") as error:
        _ = project(source, harness, out, PKL, profile="kotlin-type-design")
    assert error.value.code == Code.UNSUPPORTED_CAPABILITY
    assert not out.exists()


def test_content_profile_rejects_unknown_profile(source: Path, tmp_path: Path) -> None:
    assert PKL
    out = tmp_path / "rejected"
    with pytest.raises(ProjectionError) as error:
        _ = project(source, "pi", out, PKL, profile="missing")
    assert error.value.code == Code.PKL_REJECTED
    assert not out.exists()


def test_content_selection_still_examines_unselected_source(source: Path, tmp_path: Path) -> None:
    assert PKL
    _ = (source / "source/skills/pkl-engineering/SKILL.md").write_text("No skill metadata.\n")
    out = tmp_path / "rejected"
    with pytest.raises(ProjectionError) as error:
        _ = project(source, "pi", out, PKL, profile="kotlin-type-design")
    assert error.value.code == Code.PKL_REJECTED
    assert not out.exists()


@pytest.mark.parametrize(
    ("harness", "prefix"),
    [("codex", ".agents/plugins"), ("github-copilot", ".github/plugin"), ("pi", ".pi/slopsentral")],
)
def test_projection_needs_no_node(
    source: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, harness: str, prefix: str
) -> None:
    assert PKL
    git = shutil.which("git")
    assert git
    binaries = tmp_path / "bin"
    binaries.mkdir()
    (binaries / "git").symlink_to(git)
    monkeypatch.setenv("PATH", str(binaries))
    assert shutil.which("node") is None
    out = tmp_path / harness
    result = project(source, harness, out, PKL)
    assert result["type"] == "PROJECTED"
    bundle = out / prefix / "software-engineering"
    assert (bundle / "skills/semantic-ratchet/SKILL.md").read_bytes() == (
        source / "source/skills/semantic-ratchet/SKILL.md"
    ).read_bytes()
    assert not (bundle / "hooks").exists()
    assert not (bundle / "instructions").exists()
    assert not (out / prefix / "kotlin-engineering/.mcp.json").exists()
    if harness != "github-copilot":
        lock = obj(json.loads((out / prefix / "marketplace-lock.json").read_text()))
        for raw_plugin in array(lock["plugins"]):
            plugin = obj(raw_plugin)
            for raw_ref in array(plugin["references"]):
                ref = obj(raw_ref)
                target = out / prefix / str(plugin["name"]) / str(ref["targetPath"])
                expected = hashlib.sha256()
                if target.is_file():
                    expected.update(target.read_bytes())
                else:
                    for file in sorted(
                        (path for path in target.rglob("*") if path.is_file()),
                        key=lambda path: path.relative_to(target).as_posix(),
                    ):
                        expected.update(
                            file.relative_to(target).as_posix().encode()
                            + b"\0"
                            + file.read_bytes()
                            + b"\0"
                        )
                assert ref["sha256"] == "sha256:" + expected.hexdigest()


@pytest.mark.parametrize(
    "mutation",
    [
        "unknown-kind",
        "unknown-profile-plugin",
        "unknown-skill",
        "version-mismatch",
        "cycle",
        "bad-header",
    ],
)
def test_pkl_rejects_invalid_composition(source: Path, tmp_path: Path, mutation: str) -> None:
    assert PKL
    manifest = "source/plugins/software-engineering/plugin.json"
    match mutation:
        case "unknown-kind":
            change(
                source,
                manifest,
                "skills",
                [
                    {
                        "type": "STRING",
                        "name": "semantic-ratchet",
                        "path": "skills/semantic-ratchet",
                        "source": {"type": "LOCAL_SOURCE", "path": "./"},
                    }
                ],
            )
        case "unknown-profile-plugin":
            change(source, "source/profiles/local-development-default.json", "plugins", ["absent"])
        case "unknown-skill":
            change(
                source,
                "source/profiles/local-development-default.json",
                "skills",
                {"skill:absent": {"invocation": "either"}},
            )
        case "version-mismatch":
            change(source, manifest, "version", "99.0.0")
        case "bad-header":
            _ = (source / "source/skills/semantic-ratchet/SKILL.md").write_text(
                "This has no skill metadata.\n"
            )
        case "cycle":
            file = source / manifest
            payload = obj(json.loads(file.read_text()))
            ref = obj(array(payload["skills"])[0])
            ref["dependsOn"] = [dict(ref)]
            _ = file.write_text(json.dumps(payload))
        case _:
            pytest.fail("Unknown controlled mutation")
    out = tmp_path / "rejected"
    with pytest.raises(ProjectionError) as caught:
        _ = project(source, "codex", out, PKL)
    assert caught.value.code == Code.PKL_REJECTED
    assert not out.exists()


def test_existing_output_and_source_paths_are_protected(source: Path, tmp_path: Path) -> None:
    assert PKL
    out = tmp_path / "existing"
    out.mkdir()
    marker = out / "user.txt"
    _ = marker.write_text("keep")
    with pytest.raises(ProjectionError, match="already exists"):
        _ = project(source, "codex", out, PKL)
    assert marker.read_text() == "keep"
    with pytest.raises(ProjectionError) as caught:
        _ = project(source, "codex", source / "projection", PKL)
    assert caught.value.code == Code.UNSAFE_PATH


def test_missing_evaluator_reports_readiness(source: Path, tmp_path: Path) -> None:
    out = tmp_path / "missing-evaluator"
    with pytest.raises(ProjectionError) as caught:
        _ = project(source, "codex", out, str(tmp_path / "absent-pkl"))
    assert caught.value.code == Code.PKL_UNAVAILABLE
    assert not out.exists()


def test_native_input_keeps_the_default_small(source: Path) -> None:
    assert PKL
    value = source_input(source, snapshot(source), PKL)
    plugins = [obj(raw) for raw in array(value["plugins"])]
    selected = next(plugin for plugin in plugins if plugin["name"] == "software-engineering")
    references = [obj(raw) for raw in array(selected["references"])]
    assert [(ref["type"], ref["name"]) for ref in references] == [("SKILL", "semantic-ratchet")]
