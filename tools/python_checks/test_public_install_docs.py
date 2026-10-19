from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_readme_and_site_expose_setup_without_retired_routes() -> None:
    readme = (ROOT / "README.md").read_text()
    assert len(readme.splitlines()) <= 40
    for source in ("README.md", "docs/public/guides/install.mdx", "docs/public/guides/pi.mdx"):
        content = (ROOT / source).read_text()
        assert "bash -o pipefail -c 'curl -fsSL" in content
        assert "tools/install-pi.sh | sh" in content
        for obsolete in ("--slopsentral-profile", "/slopsentral state", "SLOPSENTRAL_PI_VERSION"):
            assert obsolete not in content
    for page in (ROOT / "docs/public").rglob("*.mdx"):
        assert not re.search(
            r"https://github\.com/amichne/slopsentral/blob/[^)\s]+\.md(?:[)#\s]|$)",
            page.read_text(),
        ), page


def test_public_guidance_has_no_outside_workflow_helper() -> None:
    for page in (ROOT / "docs/public").rglob("*.mdx"):
        content = page.read_text().lower()
        for obsolete in ("browser-harness", "superpowers", "worktrunk"):
            assert obsolete not in content, page
