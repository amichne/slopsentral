from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING

import documentation as docs
import pytest
from jsonschema import Draft202012Validator

if TYPE_CHECKING:
    from jsonschema.protocols import Validator


def write(root: Path, name: str, content: str) -> None:
    target = root / name
    target.parent.mkdir(parents=True, exist_ok=True)
    _ = target.write_text(content)


def fixture(root: Path) -> None:
    _ = subprocess.run(["git", "init", "--quiet", str(root)], check=True)
    write(root, "source/service.py", "def run(): return 1\n")
    write(root, "docs/index.md", "[Guide](guide.md)\n[Knowledge](../openwiki/index.md)\n")
    write(root, "docs/guide.md", "# Guide\n\nUse the [source](../source/service.py).\n")
    write(
        root,
        "openwiki/flow.md",
        "---\ntype: Runtime Flow\ntitle: Flow\ndescription: Service behavior.\n---\n# Flow\n\n[Guide](../docs/guide.md)\n",
    )
    write(root, "openwiki/index.md", "[Flow](flow.md)\n")
    write(root, "openwiki/.last-update.json", '{"status":"complete"}')
    write(root, "openwiki/.claims/flow.json", '{"claims":[{"id":"claim-1"}]}')
    write(
        root,
        "docs/coverage.json",
        json.dumps(
            {
                "schemaVersion": 2,
                "knowledge": {"type": "OPENWIKI", "root": "openwiki"},
                "sourceRoots": ["source/"],
                "documentRoots": ["docs/", "openwiki/"],
                "entrypoints": ["docs/index.md", "openwiki/index.md"],
                "auxiliary": [],
                "fingerprintIgnores": [],
                "areas": [
                    {
                        "id": "service",
                        "sources": ["source/"],
                        "pages": ["docs/guide.md", "openwiki/flow.md"],
                    }
                ],
                "archives": [],
            }
        ),
    )


def test_source_change_requires_review_without_rewriting_lock(tmp_path: Path) -> None:
    fixture(tmp_path)
    assert docs.run(tmp_path, "record")[0] == 0
    lock = (tmp_path / "docs/knowledge.lock.json").read_bytes()
    write(tmp_path, "source/service.py", "def run(): return 2\n")
    status, report = docs.run(tmp_path, "check")
    assert status == 1
    assert report["type"] == "STALE"
    assert "source/service.py" in json.dumps(report)
    assert (tmp_path / "docs/knowledge.lock.json").read_bytes() == lock


@pytest.mark.parametrize(
    "change",
    [
        "delete-source",
        "new-source",
        "page-edit",
        "broken-anchor",
        "broken-link",
        "orphan-page",
        "unfinished",
        "missing-claims",
        "invalid-okf",
    ],
)
def test_nearest_rejections(tmp_path: Path, change: str) -> None:
    fixture(tmp_path)
    assert docs.run(tmp_path, "record")[0] == 0
    replacements = {
        "new-source": ("source/new.py", "pass\n"),
        "page-edit": (
            "openwiki/flow.md",
            "---\ntype: Runtime Flow\ntitle: Flow\ndescription: Changed.\n---\n# Flow\n",
        ),
        "broken-anchor": ("docs/guide.md", "# Guide\n[Missing](../openwiki/flow.md#missing)\n"),
        "broken-link": ("docs/guide.md", "# Guide\n[Missing](absent.md)\n"),
        "orphan-page": ("docs/orphan.md", "# Unmapped\n"),
        "unfinished": ("openwiki/.run.json", "{}"),
        "invalid-okf": ("openwiki/flow.md", "# No metadata\n"),
    }
    removals = {
        "delete-source": "source/service.py",
        "missing-claims": "openwiki/.claims/flow.json",
    }
    if change in removals:
        (tmp_path / removals[change]).unlink()
    else:
        name, text = replacements[change]
        write(tmp_path, name, text)
    assert docs.run(tmp_path, "check")[0] != 0
    if change not in {"new-source", "page-edit"}:
        assert docs.run(tmp_path, "record")[0] != 0


def test_record_and_check_use_real_cli_with_literal_paths(tmp_path: Path) -> None:
    root = tmp_path / "project ; literal"
    root.mkdir()
    fixture(root)
    script = Path(docs.__file__)
    for command in ("record", "check"):
        result = subprocess.run(
            ["uv", "run", "--locked", "--script", str(script), command, "--repo", str(root)],
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        assert json.loads(result.stdout)["type"] in {"RECORDED", "CURRENT"}
    state = json.loads((root / "docs/knowledge.lock.json").read_text())
    assert (
        state["areas"]["service"]["source/service.py"]
        == hashlib.sha256((root / "source/service.py").read_bytes()).hexdigest()
    )


def test_missing_repository_and_duplicate_keys_fail(tmp_path: Path) -> None:
    assert docs.run(tmp_path, "check")[0] == 2
    fixture(tmp_path)
    write(tmp_path, "docs/coverage.json", '{"areas": [], "areas": []}')
    assert docs.run(tmp_path, "record")[0] == 2


def test_product_version_exception_preserves_composition_evidence() -> None:
    name = "plugins/core.json"
    rules = (docs.FingerprintIgnore(name, (("version",),)),)
    assert docs.source_bytes(name, b'{"version":"1.0.0","skills":[]}', rules) == docs.source_bytes(
        name, b'{"version":"1.0.1","skills":[]}', rules
    )
    assert docs.source_bytes(
        name, b'{"version":"1.0.1","skills":["new"]}', rules
    ) != docs.source_bytes(name, b'{"version":"1.0.1","skills":[]}', rules)
    # Another project receives no implicit Slopsentral version exception.
    assert docs.source_bytes(name, b'{"version":"1.0.0"}') != docs.source_bytes(
        name, b'{"version":"1.0.1"}'
    )


def test_mapped_but_unreachable_page_is_rejected(tmp_path: Path) -> None:
    fixture(tmp_path)
    write(tmp_path, "docs/disconnected.md", "# Disconnected\n")
    value = json.loads((tmp_path / "docs/coverage.json").read_text())
    value["areas"][0]["pages"].append("docs/disconnected.md")
    write(tmp_path, "docs/coverage.json", json.dumps(value))
    status, report = docs.run(tmp_path, "record")
    assert status == 2
    assert "Unreachable pages" in str(report)


def test_unmapped_source_is_not_silently_covered(tmp_path: Path) -> None:
    fixture(tmp_path)
    write(tmp_path, "tools/new.py", "pass\n")
    spec = json.loads((tmp_path / "docs/coverage.json").read_text())
    spec["sourceRoots"].append("tools/")
    write(tmp_path, "docs/coverage.json", json.dumps(spec))
    status, report = docs.run(tmp_path, "record")
    assert status == 2
    assert "tools/new.py" in str(report)


def test_source_symlink_is_rejected(tmp_path: Path) -> None:
    fixture(tmp_path)
    target = tmp_path / "source/service.py"
    target.unlink()
    target.symlink_to(tmp_path / "docs/guide.md")
    assert docs.run(tmp_path, "record")[0] == 2


def test_directory_links_reach_native_generated_indexes(tmp_path: Path) -> None:
    fixture(tmp_path)
    write(tmp_path, "openwiki/index.md", "[Concepts](concepts/)\n")
    write(tmp_path, "openwiki/concepts/index.md", "[Flow](../flow.md)\n")
    assert docs.run(tmp_path, "record")[0] == 0


def test_claim_receipt_change_invalidates_reviewed_evidence(tmp_path: Path) -> None:
    fixture(tmp_path)
    assert docs.run(tmp_path, "record")[0] == 0
    write(tmp_path, "openwiki/.claims/flow.json", '{"claims":[{"id":"another-claim"}]}')
    status, report = docs.run(tmp_path, "check")
    assert status == 1
    assert "openwiki/.claims/flow.json" in str(report)


def test_standalone_project_layout_uses_explicit_configuration(tmp_path: Path) -> None:
    _ = subprocess.run(["git", "init", "--quiet", str(tmp_path)], check=True)
    write(tmp_path, "app/service.py", "def run(): return 1\n")
    write(tmp_path, "README.md", "[Service](knowledge/service.md)\n[Guide](handbook/guide.md)\n")
    write(tmp_path, "handbook/guide.md", "# Guide\n[Code](../app/service.py)\n")
    write(
        tmp_path,
        "knowledge/service.md",
        "---\ntype: Service\ntitle: Service\ndescription: App behavior.\n---\n# Service\n[Guide](../handbook/guide.md)\n",
    )
    write(
        tmp_path,
        ".knowledge/coverage.json",
        json.dumps(
            {
                "schemaVersion": 2,
                "knowledge": {"type": "OKF", "root": "knowledge"},
                "sourceRoots": ["app/"],
                "documentRoots": ["README.md", "handbook/", "knowledge/"],
                "entrypoints": ["README.md"],
                "auxiliary": [],
                "archives": [],
                "fingerprintIgnores": [],
                "areas": [
                    {
                        "id": "service",
                        "sources": ["app/"],
                        "pages": ["handbook/guide.md", "knowledge/service.md"],
                    }
                ],
            }
        ),
    )
    script = Path(docs.__file__)
    for command in ("record", "check"):
        result = subprocess.run(
            [
                "uv",
                "run",
                "--locked",
                "--script",
                str(script),
                command,
                "--repo",
                str(tmp_path),
                "--config",
                ".knowledge/coverage.json",
                "--lock",
                ".knowledge/review.lock.json",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stdout + result.stderr
    assert (tmp_path / ".knowledge/review.lock.json").is_file()
    assert not (tmp_path / "docs").exists()
    assert not (tmp_path / "openwiki").exists()


def test_record_preserves_a_symlinked_foreign_lock(tmp_path: Path) -> None:
    fixture(tmp_path)
    foreign = tmp_path.parent / (tmp_path.name + "-private.json")
    _ = foreign.write_text("private bytes\n")
    (tmp_path / "docs/knowledge.lock.json").symlink_to(foreign)
    assert docs.run(tmp_path, "record")[0] == 2
    assert foreign.read_text() == "private bytes\n"


def test_config_cannot_hide_knowledge_from_document_scope(tmp_path: Path) -> None:
    fixture(tmp_path)
    spec = json.loads((tmp_path / "docs/coverage.json").read_text())
    spec["documentRoots"] = ["docs/"]
    write(tmp_path, "docs/coverage.json", json.dumps(spec))
    assert docs.run(tmp_path, "record")[0] == 2


def schema_validator() -> Validator:
    schema = json.loads(
        (Path(docs.__file__).parents[1] / "references/documentation.schema.json").read_text()
    )
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def test_configurations_match_the_distributed_schema(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[2]
    validator = schema_validator()
    fixture(tmp_path)
    for source in (
        root / "docs/coverage.json",
        tmp_path / "docs/coverage.json",
        Path(docs.__file__).parents[1] / "assets/portable-project/.knowledge/coverage.json",
    ):
        spec = json.loads(source.read_text())
        assert not list(validator.iter_errors(spec))
        assert isinstance(docs.coverage(spec), docs.Coverage)
    invalid = json.loads((tmp_path / "docs/coverage.json").read_text())
    invalid["knowledge"]["type"] = "UNSUPPORTED"
    assert list(validator.iter_errors(invalid))
    assert isinstance(docs.coverage(invalid), docs.Rejected)


def test_bundled_template_is_current_in_an_independent_repository(tmp_path: Path) -> None:
    source = Path(docs.__file__).parents[1] / "assets/portable-project"
    _ = shutil.copytree(source, tmp_path, dirs_exist_ok=True)
    _ = subprocess.run(["git", "init", "--quiet", str(tmp_path)], check=True)
    status, report = docs.run(
        tmp_path, "check", ".knowledge/coverage.json", ".knowledge/review.lock.json"
    )
    assert status == 0, report
    assert report["type"] == "CURRENT"
    result = subprocess.run(
        [
            "uv",
            "run",
            "--no-project",
            "--python",
            "3.12",
            "python",
            "-m",
            "unittest",
            "discover",
            "-s",
            "app",
            "-p",
            "greeting_examples.py",
        ],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "Ran 2 tests" in result.stderr


@pytest.mark.parametrize("name", ["docs/guide.md", "openwiki/flow.md", "source/service.py"])
def test_record_cannot_replace_a_prepared_input(tmp_path: Path, name: str) -> None:
    fixture(tmp_path)
    before = (tmp_path / name).read_bytes()
    status, report = docs.run(tmp_path, "record", lock_name=name)
    assert status == 2, report
    assert (tmp_path / name).read_bytes() == before


def test_record_preserves_a_foreign_existing_target(tmp_path: Path) -> None:
    fixture(tmp_path)
    target = "docs/private-state.json"
    write(tmp_path, target, '{"private":"preserve"}\n')
    before = (tmp_path / target).read_bytes()
    status, report = docs.run(tmp_path, "record", lock_name=target)
    assert status == 2, report
    assert (tmp_path / target).read_bytes() == before
