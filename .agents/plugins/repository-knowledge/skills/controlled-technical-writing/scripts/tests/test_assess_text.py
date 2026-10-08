import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "assess_text.py"
VALE = os.environ.get("VALE_BIN") or shutil.which("vale")
sys.path.insert(0, str(SCRIPT.parent))
from assess_text import Failure, Rejected, Stage, parse_findings, parse_metrics, read_json


class AssessTextTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not VALE:
            raise AssertionError("Vale 3.24.0 is required; set VALE_BIN or install it on PATH")

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.glossary = self.root / "GLOSSARY.md"
        self.glossary.write_text(
            "- \u00a7REQUEST\u00a7: A unit of work.\n"
            "  - Known synonyms: work request, job\n", encoding="utf-8"
        )

    def run_assessment(self, text, name="README.md", glossary=True, extra=()):
        document = self.root / name
        document.write_text(text, encoding="utf-8")
        command = [sys.executable, str(SCRIPT), "--vale-bin", VALE]
        if glossary:
            command.extend(["--glossary", str(self.glossary)])
        command.extend(extra)
        command.append(str(document))
        result = subprocess.run(command, capture_output=True, text=True, cwd=self.root)
        self.assertTrue(result.stdout, result.stderr)
        return result.returncode, json.loads(result.stdout), result.stdout

    def test_independent_counts_and_readability_formula(self):
        code, result, _ = self.run_assessment("The cat sat on the mat.\n")
        self.assertEqual(code, 0, result)
        metrics = result["documents"][0]["metrics"]
        self.assertEqual(metrics["words"], 6)
        self.assertEqual(metrics["sentences"], 1)
        self.assertEqual(metrics["estimatedSyllables"], 6)
        self.assertAlmostEqual(metrics["fleschKincaidGrade"], -1.45, places=2)

    def test_context_invariance_and_separate_process_repeatability(self):
        results = []
        for name in ("README.md", "runbook.md", "guide.mdx", "draft.txt"):
            _, report, raw = self.run_assessment("The cat sat on the mat.\n", name)
            _, repeated, repeated_raw = self.run_assessment("The cat sat on the mat.\n", name)
            self.assertEqual(raw, repeated_raw)
            document = report["documents"][0]
            results.append((document["metrics"], document["findings"]))
        self.assertTrue(all(result == results[0] for result in results))

    def test_scrambled_prose_is_not_a_comprehension_proof(self):
        _, ordinary, _ = self.run_assessment("The cat sat on the mat.\n")
        _, scrambled, _ = self.run_assessment("Mat the on sat cat the.\n")
        self.assertEqual(ordinary["documents"][0]["metrics"], scrambled["documents"][0]["metrics"])
        self.assertEqual(scrambled["comprehension"]["type"], "NOT_ASSESSED")

    def test_diction_and_alias_findings_have_locations(self):
        code, result, _ = self.run_assessment("Use the job in order to start.\n")
        self.assertEqual(code, 1, result)
        findings = result["documents"][0]["findings"]
        self.assertEqual({f["category"] for f in findings}, {"DICTION", "TERMINOLOGY"})
        self.assertTrue(all(f["line"] == 1 and len(f["span"]) == 2 for f in findings))

    def test_canonical_case_and_literal_aliases(self):
        code, result, _ = self.run_assessment("Send the REQUEST.\n")
        self.assertEqual(code, 0, result)
        code, result, _ = self.run_assessment("Send the request.\n")
        self.assertEqual(code, 1, result)
        self.assertEqual(result["documents"][0]["findings"][0]["category"], "TERMINOLOGY")
        self.glossary.write_text(
            "- \u00a7REQUEST\u00a7: A unit of work.\n  - Known synonyms: job.v2\n")
        code, result, _ = self.run_assessment("Send the jobXv2.\n")
        self.assertEqual(code, 0, result)
        code, result, _ = self.run_assessment("Send the job.v2.\n")
        self.assertEqual(code, 1, result)

    def test_shared_advisories_fire_without_switching_policy(self):
        sentence = "The cat " + "sat on the mat and " * 6 + "slept.\n"
        code, result, _ = self.run_assessment(sentence)
        self.assertEqual(code, 1, result)
        rules = {f["rule"] for f in result["documents"][0]["findings"]}
        self.assertEqual(rules, {"Slopsentral.LongSentence", "Slopsentral.Grade"})
        code, result, _ = self.run_assessment("This is the best tool.\n")
        self.assertIn("Slopsentral.Claims", {f["rule"] for f in result["documents"][0]["findings"]})

    def test_policy_suppressions_and_invalid_utf8_are_rejected(self):
        code, result, _ = self.run_assessment("<!-- vale off -->\nThe cat sat on the mat.\n")
        self.assertEqual((code, result["failure"]["type"]), (2, "POLICY_OVERRIDE"))
        document = self.root / "invalid.md"
        document.write_bytes(b"\xff")
        result = subprocess.run([sys.executable, str(SCRIPT), "--vale-bin", VALE,
                                 str(document)], capture_output=True, text=True)
        self.assertEqual(json.loads(result.stdout)["failure"]["type"], "INVALID_INPUT")

    def test_unavailable_and_wrong_version_engines_are_rejected(self):
        document = self.root / "test.md"
        document.write_text("The cat sat on the mat.\n")
        wrong = self.root / "vale-other"
        wrong.write_text("#!/usr/bin/env python3\nprint('vale version 0.0.0')\n")
        wrong.chmod(0o755)
        for binary, expected in (("/missing/vale", "VALE_UNAVAILABLE"),
                                 (str(wrong), "VALE_VERSION_MISMATCH")):
            result = subprocess.run([sys.executable, str(SCRIPT), "--vale-bin", binary,
                                     str(document)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(json.loads(result.stdout)["failure"]["type"], expected)

    def test_code_urls_and_frontmatter_do_not_become_prose(self):
        text = ("---\ntitle: job in order to\n---\n"
                "# Guide\n\nThe cat sat on the mat.\n\n"
                "`job in order to`\n\n~~~text\njob in order to\n~~~\n\n"
                "[Read this](https://example.com/job/in-order-to)\n")
        code, result, _ = self.run_assessment(text)
        self.assertEqual(code, 0, result)
        self.assertEqual(result["documents"][0]["findings"], [])

    def test_headings_and_quoted_prose_are_checked(self):
        code, result, _ = self.run_assessment(
            "# job\n\nThe cat sat on the mat.\n\n> job\n")
        self.assertEqual(code, 1, result)
        aliases = [f for f in result["documents"][0]["findings"]
                   if f["rule"] == "Slopsentral.Terminology"]
        self.assertEqual([f["line"] for f in aliases], [1, 5])

    def test_glossary_markers_are_not_document_terms(self):
        code, result, _ = self.run_assessment("Send the \u00a7REQUEST\u00a7.\n")
        self.assertEqual(code, 1, result)
        self.assertIn("Slopsentral.GlossaryMarker",
                      [f["rule"] for f in result["documents"][0]["findings"]])

    def test_missing_glossary_remains_unassessed(self):
        code, result, _ = self.run_assessment("The cat sat on the mat.\n", glossary=False)
        self.assertEqual(code, 2, result)
        self.assertEqual(result["glossary"]["type"], "NOT_PROVIDED")
        self.assertEqual(result["type"], "INCOMPLETE")

    def test_invalid_glossary_is_rejected_by_existing_owner(self):
        self.glossary.write_text("- \u00a7REQUEST\u00a7: A unit of work.\n", encoding="utf-8")
        code, result, _ = self.run_assessment("The cat sat on the mat.\n")
        self.assertEqual(code, 2, result)
        self.assertEqual(result["failure"]["type"], "INVALID_GLOSSARY")

    def test_empty_code_only_and_missing_files_fail_closed(self):
        for text in ("", "```text\nThe cat sat on the mat.\n```\n"):
            code, result, _ = self.run_assessment(text)
            self.assertEqual(code, 2, result)
            self.assertEqual(result["failure"]["type"], "NO_PROSE")
        result = subprocess.run([sys.executable, str(SCRIPT), "--vale-bin", VALE,
                                 str(self.root / "missing.md")], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(json.loads(result.stdout)["failure"]["type"], "INVALID_INPUT")

    def test_global_configuration_and_environment_cannot_change_policy(self):
        poison = self.root / "poison.ini"
        poison.write_text("StylesPath = /missing\n[*]\nBasedOnStyles = Missing\n")
        (self.root / ".vale.ini").write_text(poison.read_text())
        with mock.patch.dict(os.environ, {"VALE_CONFIG_PATH": str(poison),
                                                  "VALE_STYLES_PATH": "/missing"}):
            code, result, _ = self.run_assessment("The cat sat on the mat.\n")
        self.assertEqual(code, 0, result)

    def test_multiple_documents_retain_individual_measurements(self):
        first = self.root / "README.md"
        second = self.root / "runbook.md"
        first.write_text("The cat sat on the mat.\n")
        second.write_text("Send the job.\n")
        result = subprocess.run([sys.executable, str(SCRIPT), "--vale-bin", VALE,
                                 "--glossary", str(self.glossary), str(first), str(second)],
                                capture_output=True, text=True)
        report = json.loads(result.stdout)
        self.assertEqual(result.returncode, 1, report)
        self.assertEqual([d["path"] for d in report["documents"]], [str(first), str(second)])
        self.assertEqual(report["documents"][0]["findings"], [])
        self.assertTrue(report["documents"][1]["findings"])

    def test_every_resource_is_integrity_checked(self):
        skill = Path(__file__).parents[2]
        copy = self.root / "skill"
        shutil.copytree(skill, copy)
        (copy / "assets/vale/styles/Slopsentral/Diction.yml").write_text("extends: existence\n")
        document = self.root / "test.md"
        document.write_text("The cat sat on the mat.\n")
        result = subprocess.run([sys.executable, str(copy / "scripts/assess_text.py"),
                                 "--vale-bin", VALE, str(document)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(json.loads(result.stdout)["failure"]["type"], "POLICY_DRIFT")


class ValeBoundaryTest(unittest.TestCase):
    def test_ambiguous_and_nonfinite_json_is_rejected(self):
        for value in ('{"words": 6, "words": 7}', '{"grade": NaN}', '{"grade": Infinity}'):
            self.assertIsInstance(read_json(value, Stage.METRICS), Rejected)

    def test_invalid_metrics_do_not_construct_counts(self):
        for value in ([], {"words": True}, {"words": 6, "sentences": 1, "syllables": 6,
                                           "flesch_kincaid": float("nan")},
                      {"words": 6, "sentences": 1, "syllables": 6, "flesch_kincaid": 10}):
            result = parse_metrics(value)
            self.assertIsInstance(result, Rejected)
            self.assertEqual(result.failure, Failure.INVALID_VALE_OUTPUT)
        for value in ({"words": 10**500, "sentences": 1, "syllables": 6, "flesch_kincaid": 0},
                      {"words": 6, "sentences": 1, "syllables": 6, "flesch_kincaid": 10**500}):
            self.assertEqual(parse_metrics(value).failure, Failure.INVALID_VALE_OUTPUT)

    def test_unknown_rules_and_invalid_locations_are_rejected(self):
        valid = {"Check": "Slopsentral.Diction", "Line": 1, "Span": [1, 3],
                 "Severity": "warning", "Message": "Use a concrete verb."}
        for change in ({"Check": "Unknown.Rule"}, {"Check": []}, {"Line": True}, {"Span": [3, 1]},
                       {"Severity": "unknown"}, {"Message": ""}):
            self.assertIsInstance(parse_findings({"file.md": [valid | change]}, "file.md"), Rejected)
        self.assertIsInstance(parse_findings({"other.md": [valid]}, "file.md"), Rejected)


if __name__ == "__main__":
    unittest.main()
