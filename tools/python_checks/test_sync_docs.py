from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from tools.sync_docs import Failure, Rejected, Rendered, render

ROOT = Path(__file__).resolve().parents[2]


def test_rewrites_source_links_but_preserves_examples() -> None:
    result = render(
        "# Pi harness\n\nRead [schema](../source/schemas/pi/settings.schema.json).\n"
        "Read [guide](agent-marketplaces.md#pi).\n"
        "Use [site](/reference/releases).\n"
        "Keep [web](https://example.com) and [section](#settings).\n"
        "```markdown\n[example](../literal.md)\n```\n"
    )
    assert isinstance(result, Rendered)
    assert (
        "https://github.com/amichne/slopsentral/blob/main/source/schemas/pi/settings.schema.json"
        in result.content
    )
    assert (
        "https://github.com/amichne/slopsentral/blob/main/docs/agent-marketplaces.md#pi"
        in result.content
    )
    assert "[site](/reference/releases)" in result.content
    assert "[web](https://example.com)" in result.content
    assert "[section](#settings)" in result.content
    assert "```markdown\n[example](../literal.md)\n```" in result.content
    assert result.content.startswith('---\ntitle: "Use Slopsentral in Pi"\n')
    assert "Do not edit this page" in result.content


def test_rejects_unexpected_owner_before_projection() -> None:
    assert render("# Wrong source\n\nBody.\n") == Rejected(Failure.INVALID_SOURCE)


def invoke(root: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(ROOT / "tools/sync_docs.py"), "--root", str(root), *arguments],
        capture_output=True,
        text=True,
        check=False,
    )


def test_cli_detects_drift_without_writes_and_regenerates(tmp_path: Path) -> None:
    root = tmp_path / "literal $(name); with spaces"
    source = root / "docs/pi-harness.md"
    source.parent.mkdir(parents=True)
    _ = source.write_text("# Pi harness\n\nUse Pi.\n")
    target = root / "docs/public/guides/pi.mdx"
    missing = invoke(root, "--check")
    assert missing.returncode == 1
    assert '"reason": "STALE"' in missing.stdout
    assert not target.exists()
    assert invoke(root).returncode == 0
    assert invoke(root, "--check").returncode == 0
    before = target.read_bytes()
    _ = source.write_text("# Pi harness\n\nUse current Pi.\n")
    assert invoke(root, "--check").returncode == 1
    assert target.read_bytes() == before
    assert invoke(root).returncode == 0
    assert "Use current Pi." in target.read_text()
    assert invoke(root, "--check").returncode == 0


def test_missing_and_invalid_sources_preserve_existing_output(tmp_path: Path) -> None:
    target = tmp_path / "docs/public/guides/pi.mdx"
    target.parent.mkdir(parents=True)
    _ = target.write_text("Keep this page.\n")
    assert '"reason": "READ_FAILED"' in invoke(tmp_path).stdout
    source = tmp_path / "docs/pi-harness.md"
    _ = source.write_text("# Unexpected\n")
    assert '"reason": "INVALID_SOURCE"' in invoke(tmp_path).stdout
    assert target.read_text() == "Keep this page.\n"
