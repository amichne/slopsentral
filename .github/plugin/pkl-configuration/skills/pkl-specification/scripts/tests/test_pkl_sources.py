from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "pkl_sources"


class PklSourcesCliTests(unittest.TestCase):
    def run_cli(
        self,
        *args: str,
        cwd: Path | None = None,
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(SCRIPT), *args],
            cwd=cwd,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_catalog_lists_only_declared_first_party_sources(self) -> None:
        result = self.run_cli("catalog")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("source_count:", result.stdout)
        self.assertIn("apple/pkl", result.stdout)
        self.assertIn("https://github.com/apple/pkl", result.stdout)

    def test_sync_rejects_local_sources_without_explicit_opt_in(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            manifest = self.write_local_manifest(root, root / "upstream")

            result = self.run_cli(
                "sync",
                "--manifest",
                str(manifest),
                "--cache",
                str(root / "cache"),
            )

        self.assertEqual(result.returncode, 2)
        self.assertIn("--allow-local-sources", result.stdout)

    def test_sync_and_index_record_exact_commits_and_discovered_symbols(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            upstream = root / "upstream"
            self.init_repo(upstream)
            manifest = self.write_local_manifest(root, upstream)
            cache = root / "cache"
            output = root / "reference-index.json"

            sync = self.run_cli(
                "sync",
                "--manifest",
                str(manifest),
                "--cache",
                str(cache),
                "--allow-local-sources",
            )
            index = self.run_cli(
                "index",
                "--manifest",
                str(manifest),
                "--cache",
                str(cache),
                "--out",
                str(output),
            )

            self.assertEqual(sync.returncode, 0, sync.stdout + sync.stderr)
            self.assertEqual(index.returncode, 0, index.stdout + index.stderr)
            lock = json.loads((cache / "sources.lock.json").read_text())
            payload = json.loads(output.read_text())

        self.assertEqual(lock["schemaVersion"], 1)
        self.assertRegex(lock["sources"][0]["commit"], r"^[0-9a-f]{40}$")
        self.assertEqual(payload["schemaVersion"], 1)
        self.assertEqual(payload["sources"][0]["commit"], lock["sources"][0]["commit"])
        entries = payload["sources"][0]["entries"]
        self.assertIn(
            {"kind": "heading", "path": "docs/guide.md", "name": "Typed contracts"},
            entries,
        )
        self.assertIn(
            {"kind": "module", "path": "src/Example.pkl", "name": "example.Example"},
            entries,
        )
        self.assertIn(
            {"kind": "class", "path": "src/Example.pkl", "name": "Service"},
            entries,
        )

    def test_index_rejects_a_dirty_checkout_even_when_head_matches_the_lock(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            upstream = root / "upstream"
            self.init_repo(upstream)
            manifest = self.write_local_manifest(root, upstream)
            cache = root / "cache"
            sync = self.run_cli(
                "sync",
                "--manifest",
                str(manifest),
                "--cache",
                str(cache),
                "--allow-local-sources",
            )
            self.assertEqual(sync.returncode, 0, sync.stdout + sync.stderr)
            (cache / "fixture" / "docs" / "guide.md").write_text(
                "# Locally modified\n",
                encoding="utf-8",
            )

            result = self.run_cli(
                "index",
                "--manifest",
                str(manifest),
                "--cache",
                str(cache),
                "--out",
                str(root / "index.json"),
            )

        self.assertEqual(result.returncode, 2)
        self.assertIn("uncommitted changes", result.stdout)

    @staticmethod
    def init_repo(path: Path) -> None:
        (path / "docs").mkdir(parents=True)
        (path / "src").mkdir()
        (path / "docs" / "guide.md").write_text(
            "# Guide\n\n## Typed contracts\n",
            encoding="utf-8",
        )
        (path / "src" / "Example.pkl").write_text(
            "module example.Example\n\nclass Service { name: String }\n",
            encoding="utf-8",
        )
        subprocess.run(["git", "init", "-q", str(path)], check=True)
        subprocess.run(["git", "-C", str(path), "add", "."], check=True)
        subprocess.run(
            [
                "git",
                "-C",
                str(path),
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.com",
                "commit",
                "-qm",
                "fixture",
            ],
            check=True,
        )

    @staticmethod
    def write_local_manifest(root: Path, upstream: Path) -> Path:
        manifest = root / "sources.json"
        manifest.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "sources": [
                        {
                            "id": "fixture",
                            "repository": str(upstream),
                            "branch": "HEAD",
                            "role": "Fixture source",
                            "include": ["docs/**/*.md", "src/**/*.pkl"],
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        return manifest


if __name__ == "__main__":
    unittest.main()
