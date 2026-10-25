from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

from tools import release_assets
from tools.pi_candidate import CandidateError, Failure, mapping, sequence

ROOT = Path(__file__).resolve().parents[2]


def workflow(name: str) -> dict[str, object]:
    source = (ROOT / ".github/workflows" / name).read_text().replace("\non:", '\n"on":')
    value: object = yaml.safe_load(source)
    assert mapping(value)
    return value


def field(value: object, *names: str) -> object:
    for name in names:
        assert mapping(value)
        value = value[name]
    return value


def commands(job: object) -> str:
    steps = field(job, "steps")
    assert sequence(steps)
    return "\n".join(str(step.get("run", "")) for step in steps if mapping(step))


def test_release_only_promotes_a_successful_main_push_without_rebuilding() -> None:
    release = workflow("release-pi.yml")
    assert field(release, "on", "workflow_run", "workflows") == ["Validate Source"]
    assert field(release, "on", "workflow_run", "branches") == ["main"]
    job = field(release, "jobs", "release")
    selector = field(release, "jobs", "select")
    condition = str(field(selector, "if"))
    assert field(job, "needs") == "select"
    assert field(job, "if") == "needs.select.outputs.release == 'true'"
    assert "tools.release_version select" in commands(selector)
    assert "github.event.workflow_run.event == 'push'" in condition
    assert "github.event.workflow_run.conclusion == 'success'" in condition
    assert "github.ref == 'refs/heads/main'" in condition
    steps = field(job, "steps")
    assert sequence(steps)
    checkouts = [
        step for step in steps if mapping(step) and step.get("uses") == "actions/checkout@v4"
    ]
    assert len(checkouts) == 1
    assert field(checkouts[0], "with", "ref") == "${{ github.workflow_sha }}"
    script = commands(job)
    assert "pi_candidate.py promote" in script
    assert "setup_assets admit-run" in script
    assert script.index("setup_assets verify") < script.index("release_assets ensure-tag")
    assert script.index("release_assets verify") < script.index("release_assets ensure-tag")
    for harness in ["codex", "github-copilot", "amp"]:
        assert f"slopsentral-{harness}.tar.gz" in script
    assert script.index("--draft=false --latest") < script.index("tools.release_version finalize")
    assert script.index("release_assets ensure-tag") < script.index("gh release create")
    assert script.index("sha256sum -c SHA256SUMS") < script.index("--draft=false --latest")
    for forbidden in [
        "npm ci",
        "package_pi.py",
        "project-marketplaces.mjs",
        "--clobber",
        "git push",
        "gh release delete",
    ]:
        assert forbidden not in script
    for required in [
        "--verify-tag --draft",
        "setup-pi.mts",
        "setup.json",
        "candidate.json",
        "promotion.json",
    ]:
        assert required in script


def test_pi_candidate_is_source_bound_and_installed_before_sealing() -> None:
    candidate = field(workflow("validate-source.yml"), "jobs", "pi-candidate")
    assert field(candidate, "needs") == "validate"
    assert field(candidate, "permissions") == {"contents": "read", "actions": "read"}
    assert "github.event.pull_request.head.sha || github.sha" in str(candidate)
    script = commands(candidate)
    assert "tools/project-marketplaces.mjs --source . --harness pi" in script
    assert "tools/tests/pi-*.test.mjs" in script
    assert script.index("pi-install.test.mjs") < script.index("pi_candidate.py seal")
    assert script.index("pi-setup.test.mjs") < script.index("setup_assets package")
    for retired in ["marketplace.py", "docs:sync", "mint", "pi_candidate.py reuse"]:
        assert retired not in script


def test_consumer_required_producer_steps_exist_in_the_actual_workflow() -> None:
    jobs = field(workflow("validate-source.yml"), "jobs")
    assert mapping(jobs)
    required = {
        "validate": [
            "Compile Kotlin concepts and forbidden calls",
            "Validate Pkl facade against native Pkl",
            "Project all three harnesses and execute installed adapter contracts",
        ],
        "pi-candidate": [
            "Examine every Pi contract through the native host",
            "Install the candidate archive through the native Pi CLI",
            "Test native setup and recovery",
            "Retain the tested setup installer",
        ],
    }
    installer = (ROOT / "tools/setup-pi.mts").read_text()
    for name, expected in required.items():
        steps = field(jobs[name], "steps")
        assert sequence(steps)
        actual = [step.get("name") for step in steps if mapping(step)]
        assert str(field(jobs[name], "name")) in installer
        for step in expected:
            assert actual.count(step) == 1
            assert step in installer


def test_provider_publication_remains_independent() -> None:
    source = (ROOT / ".github/workflows/publish-harnesses.yml").read_text()
    for harness in ["codex", "github-copilot", "amp"]:
        assert f"harness: {harness}" in source
    assert "pi_candidate" not in source
    assert "release-pi" not in source


def test_release_please_only_proposes_one_shared_version_with_app_credentials() -> None:
    config = json.loads((ROOT / "release-please-config.json").read_bytes())
    assert config["versioning"] == "always-bump-patch"
    assert config["skip-github-release"] is True
    assert set(config["packages"]) == {"."}
    release_pr = workflow("release-please.yml")
    assert field(release_pr, "on", "workflow_run", "workflows") == ["Release Slopsentral"]
    job = field(release_pr, "jobs", "release-pr")
    assert "github.event.workflow_run.conclusion == 'success'" in str(field(job, "if"))
    steps = field(job, "steps")
    assert sequence(steps)
    token = [
        step
        for step in steps
        if mapping(step)
        and str(step.get("uses", "")).startswith("actions/create-github-app-token@")
    ]
    action = [
        step
        for step in steps
        if mapping(step)
        and str(step.get("uses", "")).startswith("googleapis/release-please-action@")
    ]
    assert len(token) == len(action) == 1
    assert field(token[0], "with", "app-id") == "${{ secrets.RELEASE_PLEASE_APP_ID }}"
    assert field(token[0], "with", "private-key") == "${{ secrets.RELEASE_PLEASE_APP_PRIVATE_KEY }}"
    assert field(action[0], "with", "token") == "${{ steps.app.outputs.token }}"
    assert field(action[0], "with", "skip-github-release") is True
    assert "release create" not in commands(job)


def test_existing_tag_is_never_replaced(monkeypatch: pytest.MonkeyPatch) -> None:
    revision = "a" * 40
    tag = "slopsentral-v0.1.123"
    existing = f"{revision}\trefs/tags/{tag}"
    calls: list[list[str]] = []

    def run(arguments: list[str]) -> str:
        calls.append(arguments)
        return existing if arguments[0] == "git" else ""

    monkeypatch.setattr(release_assets, "run_command", run)
    release_assets.ensure_tag("amichne/slopsentral", tag, revision)
    assert len(calls) == 1
    existing = f"{'b' * 40}\trefs/tags/{tag}"
    with pytest.raises(CandidateError, match=Failure.WRONG_PRODUCER):
        release_assets.ensure_tag("amichne/slopsentral", tag, revision)
    assert len(calls) == 2
    existing = ""
    release_assets.ensure_tag("amichne/slopsentral", tag, revision)
    assert calls[-1] == [
        "gh",
        "api",
        "--method",
        "POST",
        "repos/amichne/slopsentral/git/refs",
        "-f",
        f"ref=refs/tags/{tag}",
        "-f",
        f"sha={revision}",
    ]


@pytest.mark.parametrize("tag", ["main", "slopsentral-v4.0.1-beta", "slopsentral-v0.1.01"])
def test_invalid_tag_fails_before_effects(tag: str, monkeypatch: pytest.MonkeyPatch) -> None:
    def forbidden(_: list[str]) -> str:
        pytest.fail("invalid identity must not invoke git or GitHub")

    monkeypatch.setattr(release_assets, "run_command", forbidden)
    with pytest.raises(CandidateError, match=Failure.INVALID_IDENTITY):
        release_assets.ensure_tag("amichne/slopsentral", tag, "a" * 40)
