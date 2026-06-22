from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "kotlin-horizontalization-check.py"
SPEC = importlib.util.spec_from_file_location("kotlin_horizontalization_check", MODULE_PATH)
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
                    finding.severity == "fail"
                    and finding.path == "src/main/kotlin/com/acme/orders"
                    and finding.evidence["directKotlinFiles"] == 8
                    for finding in findings
                )
            )

    def test_file_member_findings_allow_sealed_hierarchy_concern(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            package = repo / "src/main/kotlin/com/acme/result"
            package.mkdir(parents=True)
            result_file = package / "Outcome.kt"
            result_file.write_text(
                "\n".join(
                    [
                        "sealed interface Outcome",
                        "data class Success(val value: String) : Outcome",
                        "data class Failure(val reason: String) : Outcome",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )

            findings = kotlin_horizontalization_check.file_member_findings(repo, [result_file])

            self.assertEqual(1, len(findings))
            self.assertEqual("concern", findings[0].severity)
            self.assertTrue(findings[0].evidence["sealedHierarchyExceptionPossible"])


if __name__ == "__main__":
    unittest.main()
