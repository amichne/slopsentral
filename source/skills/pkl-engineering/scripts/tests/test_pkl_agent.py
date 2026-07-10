from __future__ import annotations

import importlib.util
import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from importlib.machinery import SourceFileLoader
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "pkl_agent"
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "project"


def load_module():
    loader = SourceFileLoader("pkl_agent", str(SCRIPT))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class PklAgentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.module = load_module()

    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.workspace = self.root / "workspace"
        self.workspace.mkdir()
        for source in FIXTURE.rglob("*"):
            relative = source.relative_to(FIXTURE)
            target = self.workspace / relative
            if source.is_dir():
                target.mkdir(exist_ok=True)
            else:
                target.write_bytes(source.read_bytes())
        self.log = self.root / "pkl-calls.jsonl"
        self.pkl = self.root / "pkl"
        self.pkl.write_text(FAKE_PKL, encoding="utf-8")
        self.pkl.chmod(self.pkl.stat().st_mode | stat.S_IXUSR)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def run_agent(self, *args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
        command = [
            sys.executable,
            str(SCRIPT),
            "--workspace",
            str(self.workspace),
            "--pkl-bin",
            str(self.pkl),
            *args,
        ]
        process_env = os.environ.copy()
        process_env["FAKE_PKL_LOG"] = str(self.log)
        if env:
            process_env.update(env)
        return subprocess.run(command, text=True, capture_output=True, env=process_env, check=False)

    def calls(self) -> list[dict[str, object]]:
        if not self.log.exists():
            return []
        return [json.loads(line) for line in self.log.read_text(encoding="utf-8").splitlines()]

    def test_toon_encoder_uses_tabular_rows_and_quotes_structural_strings(self) -> None:
        encoded = self.module.encode_toon(
            {
                "status": "ok",
                "items": [
                    {"path": "a.pkl", "state": "valid"},
                    {"path": "b,c.pkl", "state": "invalid"},
                ],
            }
        )

        self.assertEqual(
            encoded,
            'status: ok\nitems[2]{path,state}:\n  a.pkl,valid\n  "b,c.pkl",invalid',
        )

    def test_runner_supports_shell_fallback_executables_without_shebang(self) -> None:
        executable = self.root / "jpkl-style"
        executable.write_text("echo 'Pkl 0.32.0'\n", encoding="utf-8")
        executable.chmod(executable.stat().st_mode | stat.S_IXUSR)

        result = self.module.default_runner([str(executable), "--version"], self.workspace, 5)

        self.assertEqual(result.exit_code, 0)
        self.assertEqual(result.stdout.strip(), "Pkl 0.32.0")

    def test_home_view_reports_live_workspace_content(self) -> None:
        result = self.run_agent()

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("description: Develop and validate typed Pkl configuration", result.stdout)
        self.assertIn("pklVersion: 0.32.0", result.stdout)
        self.assertIn("modules: 2", result.stdout)
        self.assertIn("tests: 1", result.stdout)
        self.assertIn("help[", result.stdout)
        self.assertEqual(result.stderr, "")

    def test_unknown_flag_is_usage_error_before_pkl_is_called(self) -> None:
        result = self.run_agent("format", "check", "--stat")

        self.assertEqual(result.returncode, 2)
        self.assertIn("error: unknown flag --stat", result.stdout)
        self.assertIn("valid flags", result.stdout)
        self.assertEqual(self.calls(), [])

    def test_unsupported_pkl_version_is_structured_error(self) -> None:
        result = self.run_agent("doctor", env={"FAKE_PKL_VERSION": "0.31.1"})

        self.assertEqual(result.returncode, 1)
        self.assertIn("status: unsupported", result.stdout)
        self.assertIn('supported: ">=0.32.0,<0.33.0"', result.stdout)

    def test_format_violation_maps_exit_11_to_operation_failure(self) -> None:
        result = self.run_agent("format", "check", "--all", env={"FAKE_FORMAT_EXIT": "11"})

        self.assertEqual(result.returncode, 1)
        self.assertIn("status: failed", result.stdout)
        self.assertIn("upstreamExit: 11", result.stdout)
        self.assertNotIn("Traceback", result.stdout)

    def test_format_apply_is_noop_when_formatter_changes_nothing(self) -> None:
        result = self.run_agent("format", "apply", "--all")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("status: noop", result.stdout)
        self.assertIn("changed: false", result.stdout)

    def test_validate_applies_agent_safe_evaluator_policy(self) -> None:
        result = self.run_agent("module", "validate", "config.pkl")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        eval_call = next(call for call in self.calls() if call["args"][0] == "eval")
        args = eval_call["args"]
        self.assertIn("--root-dir", args)
        self.assertIn(str(self.workspace.resolve()), args)
        self.assertIn("--omit-project-settings", args)
        resources = args[args.index("--allowed-resources") + 1]
        self.assertEqual(resources, "prop:,package:,projectpackage:")
        modules = args[args.index("--allowed-modules") + 1]
        self.assertIn("repl:", modules)
        self.assertNotIn("https:", modules)

    def test_test_run_is_sandboxed_and_summarizes_junit(self) -> None:
        result = self.run_agent("test", "run")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        test_call = next(call for call in self.calls() if call["args"][0] == "test")
        self.assertNotEqual(Path(test_call["cwd"]), self.workspace.resolve())
        self.assertFalse((self.workspace / "sandbox-marker").exists())
        self.assertIn("tests: 2", result.stdout)
        self.assertIn("failures: 0", result.stdout)

    def test_test_exit_10_is_failure_with_snapshot_signal(self) -> None:
        result = self.run_agent("test", "run", env={"FAKE_TEST_EXIT": "10"})

        self.assertEqual(result.returncode, 1)
        self.assertIn("expectedFilesGenerated: true", result.stdout)
        self.assertIn("upstreamExit: 10", result.stdout)

    def test_test_update_preserves_preexisting_report_directory(self) -> None:
        report_dir = self.workspace / ".pkl-agent-test-reports"
        report_dir.mkdir()
        sentinel = report_dir / "sentinel"
        sentinel.write_text("keep", encoding="utf-8")

        result = self.run_agent("test", "update")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep")

    def test_full_is_accepted_after_detail_subcommand(self) -> None:
        result = self.run_agent("module", "inspect", "config.pkl", "--full")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("truncated: false", result.stdout)

    def test_project_resolve_reports_noop_when_lock_is_unchanged(self) -> None:
        result = self.run_agent("project", "resolve")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("status: noop", result.stdout)
        self.assertIn("changed: false", result.stdout)
        resolve_call = next(call for call in self.calls() if call["args"][:2] == ["project", "resolve"])
        self.assertNotIn("--omit-project-settings", resolve_call["args"])

    def test_render_requires_explicit_output_before_pkl_is_called(self) -> None:
        result = self.run_agent("module", "render", "config.pkl", "--format", "json")

        self.assertEqual(result.returncode, 2)
        self.assertIn("error:", result.stdout)
        self.assertIn("--out", result.stdout)
        self.assertEqual(self.calls(), [])

    def test_package_verify_is_sandboxed_and_discards_artifacts(self) -> None:
        result = self.run_agent("package", "verify")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        package_call = next(call for call in self.calls() if call["args"][:2] == ["project", "package"])
        self.assertNotEqual(Path(package_call["cwd"]), self.workspace.resolve())
        self.assertNotIn("--omit-project-settings", package_call["args"])
        resources = package_call["args"][package_call["args"].index("--allowed-resources") + 1]
        self.assertIn("https://example.com/pkl-agent-fixture@1.0.0", resources)
        self.assertIn("https://example.com/pkl-agent-fixture@1.0.0.zip", resources)
        self.assertNotIn(",https:,", f",{resources},")
        self.assertIn("sandboxed: true", result.stdout)
        self.assertIn("artifacts: 1", result.stdout)
        self.assertNotIn("example@1.0.0.zip", [path.name for path in self.workspace.rglob("*")])

    def test_package_build_writes_only_to_explicit_output(self) -> None:
        output = self.root / "package-out"

        result = self.run_agent("package", "build", "--out", str(output))

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue((output / "example@1.0.0.zip").is_file())
        self.assertIn(f"output: {output.resolve()}", result.stdout)

    def test_package_remaps_absolute_workspace_project_into_sandbox(self) -> None:
        result = self.run_agent("package", "verify", str(self.workspace))

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        package_call = next(call for call in self.calls() if call["args"][:2] == ["project", "package"])
        self.assertNotIn(str(self.workspace.resolve()), package_call["args"])
        self.assertEqual(package_call["args"][-1], ".")


FAKE_PKL = r'''#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
import sys


args = sys.argv[1:]
log = os.environ.get("FAKE_PKL_LOG")
if log:
    with Path(log).open("a", encoding="utf-8") as stream:
        stream.write(json.dumps({"args": args, "cwd": str(Path.cwd().resolve())}) + "\n")

if args == ["--version"]:
    print(f"Pkl {os.environ.get('FAKE_PKL_VERSION', '0.32.0')}")
    raise SystemExit(0)

if args and args[0] == "format":
    if os.environ.get("FAKE_FORMAT_EXIT") == "11":
        print("config.pkl")
        raise SystemExit(11)
    raise SystemExit(0)

if args and args[0] == "eval":
    if args[-1].endswith("PklProject"):
        print(json.dumps({"package": {
            "uri": "package://example.com/pkl-agent-fixture@1.0.0",
            "packageZipUrl": "https://example.com/pkl-agent-fixture@1.0.0.zip",
        }}))
    else:
        print('{"service":{"port":8080}}')
    raise SystemExit(0)

if args[:2] == ["analyze", "imports"]:
    print(json.dumps({"imports": {"file:///config.pkl": ["pkl:base"]}, "resolvedImports": {}}))
    raise SystemExit(0)

if args and args[0] == "test":
    Path("sandbox-marker").write_text("sandboxed", encoding="utf-8")
    reports = Path(args[args.index("--junit-reports") + 1])
    reports.mkdir(parents=True, exist_ok=True)
    (reports / "pkl-tests.xml").write_text(
        '<testsuites tests="2" failures="0" errors="0" skipped="0" time="0.1"></testsuites>',
        encoding="utf-8",
    )
    raise SystemExit(int(os.environ.get("FAKE_TEST_EXIT", "0")))

if args[:2] == ["project", "resolve"]:
    project = Path.cwd()
    lock = project / "PklProject.deps.json"
    if not lock.exists():
        lock.write_text('{"schemaVersion":1}\n', encoding="utf-8")
    raise SystemExit(0)

if args and args[0] == "download-package":
    raise SystemExit(0)

if args[:2] == ["project", "package"]:
    out = Path(args[args.index("--output-path") + 1])
    out.mkdir(parents=True, exist_ok=True)
    (out / "example@1.0.0.zip").write_bytes(b"zip")
    raise SystemExit(0)

print(f"unsupported fake pkl invocation: {args}", file=sys.stderr)
raise SystemExit(1)
'''


if __name__ == "__main__":
    unittest.main()
