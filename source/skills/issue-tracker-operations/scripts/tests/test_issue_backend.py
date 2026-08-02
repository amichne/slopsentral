from __future__ import annotations

import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import textwrap
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "issue_backend"


class IssueBackendCliTest(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self._temporary_directory.cleanup)
        self.bin_directory = Path(self._temporary_directory.name)
        self.log_path = self.bin_directory / "provider-commands.jsonl"
        self.environment = {
            **os.environ,
            "PATH": f"{self.bin_directory}{os.pathsep}{os.environ['PATH']}",
            "ISSUE_BACKEND_TEST_LOG": str(self.log_path),
        }
        self._write_provider_double("acli")
        self._write_provider_double("gh")

    def _write_provider_double(self, name: str) -> None:
        path = self.bin_directory / name
        path.write_text(
            textwrap.dedent(
                """\
                #!/usr/bin/env python3
                import json
                import os
                from pathlib import Path
                import sys

                log_path = Path(os.environ["ISSUE_BACKEND_TEST_LOG"])
                with log_path.open("a", encoding="utf-8") as stream:
                    stream.write(json.dumps({"executable": Path(sys.argv[0]).name, "arguments": sys.argv[1:]}) + "\\n")

                arguments = sys.argv[1:]
                if Path(sys.argv[0]).name == "acli":
                    if arguments[:4] == ["jira", "workitem", "view", "KAST-42"]:
                        print(os.environ["ISSUE_BACKEND_TEST_ACLI_VIEW"])
                    elif arguments[:4] == ["jira", "workitem", "link", "list"]:
                        print(os.environ["ISSUE_BACKEND_TEST_ACLI_LINKS"])
                    else:
                        print("unexpected acli command", file=sys.stderr)
                        raise SystemExit(64)
                elif arguments[:2] == ["api", "--paginate"]:
                    endpoint = arguments[-1]
                    if endpoint.endswith("/dependencies/blocked_by?per_page=100"):
                        print(os.environ["ISSUE_BACKEND_TEST_GH_BLOCKED_BY"])
                    elif endpoint.endswith("/dependencies/blocking?per_page=100"):
                        print(os.environ["ISSUE_BACKEND_TEST_GH_BLOCKING"])
                    else:
                        print("unexpected gh endpoint", file=sys.stderr)
                        raise SystemExit(64)
                elif arguments[:3] == ["issue", "view", "42"]:
                    print(os.environ["ISSUE_BACKEND_TEST_GH_VIEW"])
                else:
                    print("unexpected gh command", file=sys.stderr)
                    raise SystemExit(64)
                """
            ),
            encoding="utf-8",
        )
        path.chmod(path.stat().st_mode | stat.S_IXUSR)

    def run_cli(
        self,
        *arguments: str,
        environment: dict[str, str] | None = None,
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(SCRIPT), *arguments],
            cwd=self.bin_directory,
            env={**self.environment, **(environment or {})},
            text=True,
            capture_output=True,
            check=False,
        )

    def commands(self) -> list[dict[str, object]]:
        if not self.log_path.exists():
            return []
        return [json.loads(line) for line in self.log_path.read_text(encoding="utf-8").splitlines()]

    def test_capabilities_selects_jira_from_environment_without_legacy_jira(self) -> None:
        completed = self.run_cli(
            "capabilities",
            "--json",
            environment={"EFFECTIVE_DELIVERY_ISSUE_BACKEND": "jira"},
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        result = json.loads(completed.stdout)
        self.assertEqual(result["type"], "ISSUE_BACKEND_RESULT")
        payload = result["result"]
        self.assertEqual(payload["outcome"], "COMPLETE")
        self.assertEqual(payload["backend"], "JIRA")
        self.assertEqual(
            payload["capabilities"],
            [
                {"type": "ISSUE_BACKEND_CAPABILITY", "name": "DIRECT_BLOCKER_MAP", "support": "NATIVE"},
                {"type": "ISSUE_BACKEND_CAPABILITY", "name": "VIEW", "support": "NATIVE"},
                {"type": "ISSUE_BACKEND_CAPABILITY", "name": "CREATE", "support": "UNSUPPORTED"},
                {"type": "ISSUE_BACKEND_CAPABILITY", "name": "UPDATE", "support": "UNSUPPORTED"},
                {"type": "ISSUE_BACKEND_CAPABILITY", "name": "COMMENT", "support": "UNSUPPORTED"},
                {"type": "ISSUE_BACKEND_CAPABILITY", "name": "HIERARCHY_MAP", "support": "UNSUPPORTED"},
            ],
        )
        self.assertNotIn("GITLAB", completed.stdout)
        self.assertEqual(self.commands(), [])

    def test_explicit_backend_overrides_environment(self) -> None:
        completed = self.run_cli(
            "--backend",
            "github",
            "capabilities",
            "--json",
            environment={"EFFECTIVE_DELIVERY_ISSUE_BACKEND": "jira"},
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(json.loads(completed.stdout)["result"]["backend"], "GITHUB")

    def test_default_output_is_toon_derived_from_the_canonical_result(self) -> None:
        completed = self.run_cli(
            "capabilities",
            environment={"EFFECTIVE_DELIVERY_ISSUE_BACKEND": "jira"},
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertTrue(completed.stdout.startswith("type: ISSUE_BACKEND_RESULT\n"))
        self.assertIn("  type: ISSUE_BACKEND_CAPABILITIES_RESULT\n", completed.stdout)
        self.assertIn("  backend: JIRA\n", completed.stdout)
        self.assertIn("  capabilities[6]{type,name,support}:\n", completed.stdout)
        self.assertFalse(completed.stdout.lstrip().startswith("{"))

    def test_toon_object_list_places_the_first_field_on_the_hyphen_line(self) -> None:
        completed = self.run_cli(
            "view",
            "KAST-42",
            environment={
                "EFFECTIVE_DELIVERY_ISSUE_BACKEND": "jira",
                "ISSUE_BACKEND_TEST_ACLI_VIEW": json.dumps(
                    {"key": "KAST-42", "fields": {"summary": "Typed Jira adapter"}}
                ),
            },
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn(
            "    - type: ISSUE_BACKEND_COMMAND_EVIDENCE\n",
            completed.stdout,
        )
        self.assertNotIn("\n    -\n", completed.stdout)

    def test_jira_view_invokes_official_acli_and_normalizes_the_issue(self) -> None:
        completed = self.run_cli(
            "view",
            "KAST-42",
            "--json",
            environment={
                "EFFECTIVE_DELIVERY_ISSUE_BACKEND": "jira",
                "ISSUE_BACKEND_TEST_ACLI_VIEW": json.dumps(
                    {
                        "key": "KAST-42",
                        "fields": {
                            "summary": "Typed Jira adapter",
                            "status": {"name": "In Progress"},
                        },
                    }
                ),
            },
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        result = json.loads(completed.stdout)
        payload = result["result"]
        self.assertEqual(
            payload["issue"],
            {
                "type": "ISSUE_BACKEND_ISSUE",
                "id": "KAST-42",
                "state": "In Progress",
                "title": "Typed Jira adapter",
            },
        )
        self.assertEqual(payload["evidence"][0]["type"], "ISSUE_BACKEND_COMMAND_EVIDENCE")
        self.assertEqual(
            self.commands(),
            [
                {
                    "executable": "acli",
                    "arguments": ["jira", "workitem", "view", "KAST-42", "--json"],
                }
            ],
        )

    def test_github_view_uses_gh_and_requires_an_explicit_repository(self) -> None:
        completed = self.run_cli(
            "view",
            "42",
            "--json",
            environment={
                "EFFECTIVE_DELIVERY_ISSUE_BACKEND": "github",
                "EFFECTIVE_DELIVERY_GITHUB_REPOSITORY": "octo/repo",
                "ISSUE_BACKEND_TEST_GH_VIEW": json.dumps(
                    {
                        "number": 42,
                        "title": "Typed GitHub adapter",
                        "state": "OPEN",
                        "url": "https://github.com/octo/repo/issues/42",
                    }
                ),
            },
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(json.loads(completed.stdout)["result"]["issue"]["id"], "42")
        self.assertEqual(
            self.commands(),
            [
                {
                    "executable": "gh",
                    "arguments": [
                        "issue",
                        "view",
                        "42",
                        "--repo",
                        "octo/repo",
                        "--json",
                        "number,title,state,url",
                    ],
                }
            ],
        )

    def test_jira_dependency_map_preserves_blocker_direction(self) -> None:
        completed = self.run_cli(
            "dependency-map",
            "KAST-42",
            "--json",
            environment={
                "EFFECTIVE_DELIVERY_ISSUE_BACKEND": "jira",
                "ISSUE_BACKEND_TEST_ACLI_LINKS": json.dumps(
                    {
                        "links": [
                            {
                                "type": {"name": "Blocks"},
                                "inwardIssue": {
                                    "key": "KAST-7",
                                    "fields": {"summary": "Schema first"},
                                },
                            },
                            {
                                "type": {"name": "Blocks"},
                                "outwardIssue": {
                                    "key": "KAST-99",
                                    "fields": {"summary": "Consumer"},
                                },
                            },
                        ]
                    }
                ),
            },
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        result = json.loads(completed.stdout)
        payload = result["result"]
        self.assertEqual(payload["type"], "ISSUE_BACKEND_DEPENDENCY_MAP_RESULT")
        self.assertEqual(payload["dependencyMap"]["type"], "ISSUE_BACKEND_DEPENDENCY_MAP")
        self.assertEqual(payload["dependencyMap"]["root"], "KAST-42")
        self.assertEqual(
            payload["dependencyMap"]["edges"],
            [
                {
                    "type": "ISSUE_BACKEND_DEPENDENCY_EDGE",
                    "relation": "BLOCKS",
                    "source": {"type": "ISSUE_BACKEND_ISSUE_REFERENCE", "id": "KAST-7", "title": "Schema first"},
                    "target": {"type": "ISSUE_BACKEND_ISSUE_REFERENCE", "id": "KAST-42"},
                },
                {
                    "type": "ISSUE_BACKEND_DEPENDENCY_EDGE",
                    "relation": "BLOCKS",
                    "source": {"type": "ISSUE_BACKEND_ISSUE_REFERENCE", "id": "KAST-42"},
                    "target": {"type": "ISSUE_BACKEND_ISSUE_REFERENCE", "id": "KAST-99", "title": "Consumer"},
                },
            ],
        )
        self.assertEqual(payload["dependencyMap"]["coverage"]["depth"], 1)
        self.assertEqual(
            payload["dependencyMap"]["coverage"]["type"],
            "ISSUE_BACKEND_DEPENDENCY_COVERAGE",
        )
        self.assertEqual(payload["dependencyMap"]["coverage"]["hierarchy"], "UNSUPPORTED")
        self.assertEqual(
            self.commands(),
            [
                {
                    "executable": "acli",
                    "arguments": ["jira", "workitem", "link", "list", "--key", "KAST-42", "--json"],
                }
            ],
        )

    def test_github_dependency_map_reads_both_native_directions(self) -> None:
        completed = self.run_cli(
            "dependency-map",
            "42",
            "--json",
            environment={
                "EFFECTIVE_DELIVERY_ISSUE_BACKEND": "github",
                "EFFECTIVE_DELIVERY_GITHUB_REPOSITORY": "octo/repo",
                "ISSUE_BACKEND_TEST_GH_BLOCKED_BY": json.dumps(
                    [[{"number": 7, "title": "Schema first"}]]
                ),
                "ISSUE_BACKEND_TEST_GH_BLOCKING": json.dumps(
                    [[{"number": 99, "title": "Consumer"}]]
                ),
            },
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        result = json.loads(completed.stdout)["result"]
        self.assertEqual(
            result["dependencyMap"]["edges"],
            [
                {
                    "type": "ISSUE_BACKEND_DEPENDENCY_EDGE",
                    "relation": "BLOCKS",
                    "source": {"type": "ISSUE_BACKEND_ISSUE_REFERENCE", "id": "7", "title": "Schema first"},
                    "target": {"type": "ISSUE_BACKEND_ISSUE_REFERENCE", "id": "42"},
                },
                {
                    "type": "ISSUE_BACKEND_DEPENDENCY_EDGE",
                    "relation": "BLOCKS",
                    "source": {"type": "ISSUE_BACKEND_ISSUE_REFERENCE", "id": "42"},
                    "target": {"type": "ISSUE_BACKEND_ISSUE_REFERENCE", "id": "99", "title": "Consumer"},
                },
            ],
        )
        self.assertEqual([command["executable"] for command in self.commands()], ["gh", "gh"])
        for command in self.commands():
            self.assertIn("X-GitHub-Api-Version: 2026-03-10", command["arguments"])

    def test_invalid_backend_is_a_typed_rejection(self) -> None:
        completed = self.run_cli(
            "capabilities",
            "--json",
            environment={"EFFECTIVE_DELIVERY_ISSUE_BACKEND": "gitlab"},
        )

        self.assertEqual(completed.returncode, 1)
        result = json.loads(completed.stdout)
        self.assertEqual(result["type"], "ISSUE_BACKEND_RESULT")
        payload = result["result"]
        self.assertEqual(payload["outcome"], "REJECTED")
        self.assertEqual(payload["type"], "ISSUE_BACKEND_FAILURE")
        self.assertEqual(payload["failure"]["id"], "BACKEND_UNSUPPORTED")
        self.assertEqual(payload["failure"]["type"], "ISSUE_BACKEND_FAILURE_DETAIL")
        self.assertEqual(payload["failure"]["mutationState"], "NOT_STARTED")
        self.assertNotIn("gitlab", completed.stderr.lower())

    def test_malformed_provider_result_retains_command_evidence(self) -> None:
        completed = self.run_cli(
            "view",
            "KAST-42",
            "--json",
            environment={
                "EFFECTIVE_DELIVERY_ISSUE_BACKEND": "jira",
                "ISSUE_BACKEND_TEST_ACLI_VIEW": json.dumps(
                    {"fields": {"summary": "Missing identity"}}
                ),
            },
        )

        self.assertEqual(completed.returncode, 1)
        payload = json.loads(completed.stdout)["result"]
        self.assertEqual(payload["failure"]["id"], "PROVIDER_OUTPUT_INVALID")
        self.assertEqual(payload["evidence"][0]["executable"], "acli")
        self.assertEqual(payload["evidence"][0]["exitCode"], 0)

    def test_provider_stderr_does_not_enter_the_canonical_failure(self) -> None:
        completed = self.run_cli(
            "view",
            "UNEXPECTED-1",
            "--json",
            environment={"EFFECTIVE_DELIVERY_ISSUE_BACKEND": "jira"},
        )

        self.assertEqual(completed.returncode, 1)
        payload = json.loads(completed.stdout)["result"]
        self.assertEqual(payload["failure"]["id"], "PROVIDER_COMMAND_FAILED")
        self.assertNotIn("unexpected acli command", completed.stdout)
        self.assertEqual(payload["evidence"][0]["exitCode"], 64)


if __name__ == "__main__":
    unittest.main()
