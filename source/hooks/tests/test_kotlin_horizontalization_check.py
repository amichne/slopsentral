from __future__ import annotations

import importlib.util
from importlib.machinery import SourceFileLoader
import sys
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "kotlin-horizontalization-check"
LOADER = SourceFileLoader("kotlin_horizontalization_check", str(MODULE_PATH))
SPEC = importlib.util.spec_from_loader(LOADER.name, LOADER)
assert SPEC is not None
assert SPEC.loader is not None
kotlin_horizontalization_check = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = kotlin_horizontalization_check
SPEC.loader.exec_module(kotlin_horizontalization_check)


class KotlinHorizontalizationCheckTest(unittest.TestCase):
    def test_collect_findings_reports_large_flat_package(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            package = repo / "src/main/kotlin/com/acme/orders"
            package.mkdir(parents=True)
            changed_file = package / "OrderCase0.kt"
            for index in range(8):
                file_path = package / f"OrderCase{index}.kt"
                file_path.write_text(f"class OrderCase{index}\n", encoding="utf-8")

            findings = kotlin_horizontalization_check.collect_findings(repo, [changed_file])

            self.assertTrue(
                any(
                    finding.severity == "concern"
                    and finding.path == "src/main/kotlin/com/acme/orders"
                    and finding.evidence["directKotlinFiles"] == 8
                    for finding in findings
                )
            )

    def test_declaration_text_cannot_establish_unrelated_top_level_owners(self) -> None:
        examples = [
            "class Outer {\n    class Nested\n}\n",
            "/*\nclass Mentioned\nclass Another\n*/\nclass Owner\n",
            'val example = """\nclass Mentioned\nclass Another\n"""\n',
            "sealed interface Outcome\ndata class Success(val value: String) : Outcome\n",
            "interface Capability\nclass Implementation : Capability\n",
        ]
        for example in examples:
            with self.subTest(example=example), tempfile.TemporaryDirectory() as directory:
                repo = Path(directory)
                package = repo / "src/main/kotlin/com/acme"
                package.mkdir(parents=True)
                source = package / "Owner.kt"
                source.write_text(example, encoding="utf-8")
                findings = kotlin_horizontalization_check.collect_findings(repo, [source])
                self.assertEqual([], findings)


if __name__ == "__main__":
    unittest.main()
