from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COMMAND = ROOT / "bin/slopsentral-prose"


def trusted_command(tmp_path: Path) -> Path:
    # Run the base command from a separate policy tree, as the trusted workflow does.
    trusted = tmp_path.parent / (tmp_path.name + "-policy")
    (trusted / "tools").mkdir(parents=True)
    (trusted / "docs").mkdir()
    script = trusted / "tools/prose.py"
    _ = shutil.copy2(COMMAND.resolve(), script)
    _ = shutil.copy2(ROOT / "tools/prose.py.lock", trusted / "tools/prose.py.lock")
    skill = Path("source/skills/controlled-technical-writing")
    _ = shutil.copytree(
        ROOT / skill, trusted / skill, ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache")
    )
    glossary = json.loads((ROOT / "docs/glossary.json").read_text())
    glossary["entries"][0]["rejectedForms"] = [
        {
            "type": "REPLACE",
            "form": "testwidget",
            "reason": "Reserved fixture alias.",
            "evidence": [{"type": "JUSTIFICATION", "text": "Test fixture."}],
        }
    ]
    _ = (trusted / "docs/glossary.json").write_text(json.dumps(glossary))
    return script


def test_changed_prose_from_a_disposable_pull_request(tmp_path: Path) -> None:
    def git(*args: str) -> str:
        return subprocess.check_output(["git", *args], cwd=tmp_path, text=True).strip()

    _ = git("init", "-q")
    _ = git("config", "user.name", "Prose Test")
    _ = git("config", "user.email", "prose@example.invalid")
    doc = tmp_path / "guide.md"
    _ = doc.write_text("Utilize the tool.\nKeep the file.\nSave the file.\n")
    _ = git("add", ".")
    _ = git("commit", "-qm", "base")
    base = git("rev-parse", "HEAD")
    _ = doc.rename(tmp_path / "how to.md")
    _ = (tmp_path / "how to.md").write_text(
        "Utilize the tool.\nKeep the file.\nSave the file.\n\nYou should save it.\n"
    )
    _ = (tmp_path / "example.mdx").write_text("Use the tool.\n\n```html\n<!-- vale off -->\n```\n")
    _ = git("add", ".")
    _ = git("commit", "-qm", "candidate")

    script = trusted_command(tmp_path)

    def assess(head: str, archive: str | None = None) -> tuple[int, dict[str, object]]:
        result = subprocess.run(
            [
                "uv",
                "run",
                "--locked",
                "--script",
                str(script),
                "changed",
                "--base",
                base,
                "--head",
                head,
            ],
            cwd=tmp_path,
            capture_output=True,
            text=True,
            check=False,
            env={**os.environ, **({"TEST_VALE_ARCHIVE": archive} if archive else {})},
        )
        return result.returncode, json.loads(result.stdout)

    code, report = assess(base)
    assert (code, report["type"]) == (0, "NO_PROSE_CHANGES")
    code, report = assess(git("rev-parse", "HEAD"))
    assert code == 0, report
    assert "Slopsentral.Modals" in json.dumps(report)
    code, report = assess(git("rev-parse", "HEAD"), str(tmp_path / "missing-archive"))
    assert (code, report["type"]) == (2, "REJECTED")
    _ = (tmp_path / "docs").mkdir()
    _ = (tmp_path / "docs/glossary.json").write_text("{}")
    _ = (tmp_path / "docs/guide.md").write_text("Start the testwidget.\n")
    _ = (tmp_path / "new.md").write_text("Utilize the tool.\n")
    _ = git("add", ".")
    _ = git("commit", "-qm", "new diction and forbidden terminology")
    code, report = assess(git("rev-parse", "HEAD"))
    assert (code, report["type"]) == (1, "BLOCKED")
    assert "Slopsentral.Terminology" in json.dumps(report)
    assert any(
        f["rule"] == "Slopsentral.Diction"
        for item in json.loads(json.dumps(report["files"]))
        if item["path"] == "new.md"
        for f in item["blocking"]
    )
    for name, text in [
        ("bad.md", "Send §REQUEST§.\n"),
        ("off.mdx", "Use the tool.\n\n{/* vale off */}\nUtilize the tool.\n"),
    ]:
        _ = (tmp_path / name).write_text(text)
    _ = git("add", ".")
    _ = git("commit", "-qm", "forbidden")
    # A clean worktree at another revision cannot change an exact-head decision.
    head = git("rev-parse", "HEAD")
    _ = git("checkout", "--detach", base)
    code, report = assess(head)
    assert code == 2, report
    assert "Slopsentral.GlossaryMarker" in json.dumps(report)
    assert "POLICY_OVERRIDE" in json.dumps(report)


def test_rename_from_file_to_directory_preserves_warning(tmp_path: Path) -> None:
    def git(*args: str) -> str:
        return subprocess.check_output(["git", *args], cwd=tmp_path, text=True).strip()

    _ = git("init", "-q")
    _ = git("config", "user.name", "Prose Test")
    _ = git("config", "user.email", "prose@example.invalid")
    path = tmp_path / "guide.md"
    prose = "Utilize the tool.\n"
    _ = path.write_text(prose)
    _ = git("add", ".")
    _ = git("commit", "-qm", "before")
    base = git("rev-parse", "HEAD")
    path.unlink()
    path.mkdir()
    _ = (path / "page.md").write_text(prose)
    _ = git("add", ".")
    _ = git("commit", "-qm", "after")
    run = subprocess.run(
        [
            "uv",
            "run",
            "--locked",
            "--script",
            str(COMMAND),
            "changed",
            "--base",
            base,
            "--head",
            "HEAD",
        ],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    assert run.returncode == 0, run.stdout + run.stderr
    assert json.loads(run.stdout)["type"] == "PASSED"
