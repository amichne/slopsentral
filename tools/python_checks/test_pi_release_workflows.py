from __future__ import annotations

from pathlib import Path

import yaml

from tools.pi_candidate import mapping, sequence

ROOT = Path(__file__).resolve().parents[2]


def workflow(name: str) -> object:
    # Quote Actions' YAML 1.2 key before the YAML 1.1-safe parser reads it.
    source = (ROOT / ".github/workflows" / name).read_text().replace("\non:", '\n"on":')
    value: object = yaml.safe_load(source)
    return value


def field(value: object, *names: str) -> object:
    for name in names:
        assert mapping(value)
        value = value[name]
    return value


def commands(job: object) -> str:
    steps = field(job, "steps")
    assert sequence(steps)
    result: list[str] = []
    for step in steps:
        assert mapping(step)
        command = step.get("run", "")
        assert isinstance(command, str)
        result.append(command)
    return "\n".join(result)


def test_pi_publication_only_consumes_a_successful_main_candidate() -> None:
    release = workflow("release-pi.yml")
    assert field(release, "on", "workflow_run", "workflows") == ["Validate Source"]
    assert field(release, "on", "workflow_run", "branches") == ["main"]
    job = field(release, "jobs", "release")
    condition = field(job, "if")
    assert isinstance(condition, str)
    assert "github.event.workflow_run.event == 'push'" in condition
    assert "github.event.workflow_run.conclusion == 'success'" in condition
    script = commands(job)
    assert "pi_candidate.py promote" in script
    assert "package_pi.py" not in script
    assert "npm ci" not in script
    assert "git push" not in script


def test_candidate_needs_full_source_success_and_installs_before_sealing() -> None:
    source = workflow("validate-source.yml")
    candidate = field(source, "jobs", "pi-candidate")
    assert field(candidate, "needs") == "validate"
    assert field(candidate, "permissions") == {"contents": "read", "actions": "read"}
    script = commands(candidate)
    assert "tools/tests/pi-*.test.mjs" in script
    assert script.index("pi-install.test.mjs") < script.index("pi_candidate.py seal")
    assert "pi_candidate.py reuse" in script
