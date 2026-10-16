from __future__ import annotations

import json
import os
import subprocess
import sys
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


def test_pi_release_surfaces_the_latest_package_and_pinned_install(tmp_path: Path) -> None:
    job = field(workflow("release-pi.yml"), "jobs", "release")
    steps = field(job, "steps")
    assert sequence(steps)
    publication = [
        step
        for step in steps
        if mapping(step) and step.get("name") == "Publish the retained archive without replacement"
    ]
    assert len(publication) == 1
    script = field(publication[0], "run")
    assert isinstance(script, str)
    capture = tmp_path / "publication.json"
    gh = tmp_path / "gh"
    _ = gh.write_text(
        f"#!{sys.executable}\n"
        "import json, os, pathlib, sys\n"
        "args = sys.argv[1:]\n"
        "if '--notes-file' in args:\n"
        "    notes = pathlib.Path(args[args.index('--notes-file') + 1]).read_text()\n"
        "else:\n"
        "    notes = args[args.index('--notes') + 1]\n"
        "pathlib.Path(os.environ['PUBLICATION']).write_text(json.dumps({'args': args, 'notes': notes}))\n"
    )
    gh.chmod(0o755)
    result = subprocess.run(
        ["bash", "-euo", "pipefail", "-c", script],
        env=os.environ
        | {
            "PATH": f"{tmp_path}{os.pathsep}{os.environ['PATH']}",
            "PUBLICATION": str(capture),
            "RUNNER_TEMP": str(tmp_path),
            "GH_REPO": "amichne/slopsentral",
            "VERSION": "0.1.123",
            "BUILD_SHA": "a" * 40,
            "SOURCE_SHA": "b" * 40,
            "ARCHIVE": str(tmp_path / "slopsentral-pi-0.1.123.tgz"),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    captured: object = json.loads(capture.read_text())
    assert mapping(captured)
    arguments = captured["args"]
    assert sequence(arguments)
    assert arguments[:3] == ["release", "create", "pi-v0.1.123"]
    assert "--latest" in arguments
    assert "--latest=false" not in arguments
    assert "--verify-tag" in arguments
    assert "--clobber" not in arguments
    notes = captured["notes"]
    assert isinstance(notes, str)
    assert (
        "pi install npm:slopsentral-pi@https://github.com/amichne/slopsentral/releases/"
        "download/pi-v0.1.123/slopsentral-pi-0.1.123.tgz"
    ) in notes
    assert "https://github.com/amichne/slopsentral/blob/pi-v0.1.123/docs/pi-harness.md" in notes
    assert "https://github.com/amichne/slopsentral/blob/pi-v0.1.123/README.md" in notes
    assert "a" * 40 in notes
    assert "b" * 40 in notes
