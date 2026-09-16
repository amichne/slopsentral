from __future__ import annotations

import importlib.util
import io
import os
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "validate-yaml-examples.py"
SPEC = importlib.util.spec_from_file_location("validate_yaml_examples", SCRIPT)
assert SPEC and SPEC.loader
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class ValidateYamlExamplesTest(unittest.TestCase):
    def run_validator(self, document: str) -> tuple[int, str, str]:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory).resolve()
            references = root / "references"
            references.mkdir()
            (references / "case.openapi.yaml").write_text(document, encoding="utf-8")
            stdout = io.StringIO()
            stderr = io.StringIO()
            previous_directory = Path.cwd()
            try:
                os.chdir(root)
                with (
                    patch.object(VALIDATOR, "REFERENCE_DIR", references),
                    redirect_stdout(stdout),
                    redirect_stderr(stderr),
                ):
                    return_code = VALIDATOR.main()
            finally:
                os.chdir(previous_directory)
        return return_code, stdout.getvalue(), stderr.getvalue()

    def test_accepts_non_nullable_contract(self) -> None:
        return_code, stdout, stderr = self.run_validator(
            "type: object\nproperties:\n  name:\n    type: string\n"
        )

        self.assertEqual(0, return_code)
        self.assertIn("OK references/case.openapi.yaml", stdout)
        self.assertEqual("", stderr)

    def test_rejects_nullable_contract(self) -> None:
        return_code, stdout, stderr = self.run_validator(
            'type: object\nproperties:\n  name:\n    type: [string, "null"]\n'
        )

        self.assertEqual(1, return_code)
        self.assertEqual("", stdout)
        self.assertIn("type unions cannot include null", stderr)


if __name__ == "__main__":
    unittest.main()
