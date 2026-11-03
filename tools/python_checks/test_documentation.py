from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import pytest

from tools import documentation as docs


def write(root: Path, name: str, content: str) -> None:
    target = root / name
    target.parent.mkdir(parents=True, exist_ok=True)
    _ = target.write_text(content)


def fixture(root: Path) -> None:
    _ = subprocess.run(["git", "init", "--quiet", str(root)], check=True)
    write(root, "source/service.py", "def run(): return 1\n")
    write(root, "docs/index.md", "[Guide](guide.md)\n[Knowledge](../openwiki/flow.md)\n")
    write(root, "docs/guide.md", "# Guide\n\nUse the [source](../source/service.py).\n")
    write(
        root,
        "openwiki/flow.md",
        "---\ntype: Runtime Flow\ntitle: Flow\ndescription: Service behavior.\n---\n# Flow\n\n[Guide](../docs/guide.md)\n",
    )
    write(root, "openwiki/.last-update.json", '{"status":"complete"}')
    write(root, "openwiki/.claims/flow.json", '{"claims":[{"id":"claim-1"}]}')
    write(
        root,
        "docs/coverage.json",
        json.dumps(
            {
                "schemaVersion": 1,
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
    name = "source/plugins/software-engineering/plugin.json"
    assert docs.source_bytes(name, b'{"version":"4.0.7","skills":[]}') == docs.source_bytes(
        name, b'{"version":"4.0.8","skills":[]}'
    )
    assert docs.source_bytes(name, b'{"version":"4.0.8","skills":["new"]}') != docs.source_bytes(
        name, b'{"version":"4.0.8","skills":[]}'
    )
    marketplace = "source/adaptable.marketplace.json"
    assert docs.source_bytes(
        marketplace, b'{"plugins":[{"plugin":{"name":"a","version":"4.0.7"}}]}'
    ) == docs.source_bytes(marketplace, b'{"plugins":[{"plugin":{"name":"a","version":"4.0.8"}}]}')


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
