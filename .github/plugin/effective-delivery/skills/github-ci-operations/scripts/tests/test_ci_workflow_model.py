from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1]
SKILL_ROOT = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS))

import ci_workflow_model as model  # noqa: E402


def task(
    task_id: str,
    *,
    needs: list[str],
    outputs: list[str],
    samples: list[int],
    execution_class: str,
) -> dict[str, object]:
    return {
        "id": task_id,
        "needs": needs,
        "outputs": outputs,
        "durationSamplesSeconds": samples,
        "executionClass": execution_class,
    }


def representative_document() -> dict[str, object]:
    baseline = {
        "tasks": [
            task(
                "gate",
                needs=[],
                outputs=["static-contracts", "runtime-contracts"],
                samples=[108, 110, 111, 112, 114],
                execution_class="static",
            ),
            task(
                "linux",
                needs=["gate"],
                outputs=["linux-artifact"],
                samples=[580, 600, 620, 640, 660],
                execution_class="gradle-cache",
            ),
            task(
                "macos",
                needs=["gate"],
                outputs=["macos-proof"],
                samples=[720, 740, 760, 780, 800],
                execution_class="gradle-cache",
            ),
            task(
                "rust",
                needs=["gate"],
                outputs=["rust-artifact"],
                samples=[290, 295, 300, 305, 310],
                execution_class="toolchain",
            ),
            task(
                "oci-22",
                needs=["linux", "macos", "rust"],
                outputs=["oci-22-proof"],
                samples=[120, 125, 130, 135, 140],
                execution_class="oci",
            ),
            task(
                "oci-24",
                needs=["linux", "macos", "rust"],
                outputs=["oci-24-proof"],
                samples=[120, 125, 130, 135, 140],
                execution_class="oci",
            ),
            task(
                "action-runtime",
                needs=["linux", "macos", "rust"],
                outputs=["action-runtime-proof"],
                samples=[190, 195, 205, 210, 220],
                execution_class="artifact-consumer",
            ),
        ],
        "fanoutGateTaskIds": ["gate"],
        "observedWorkflowDurationSamplesSeconds": [1160, 1180, 1200, 1220, 1240],
    }
    candidate = {
        "tasks": [
            task(
                "gate",
                needs=[],
                outputs=["static-contracts"],
                samples=[7, 8, 8, 9, 10],
                execution_class="static",
            ),
            task(
                "runtime",
                needs=["gate"],
                outputs=["runtime-contracts"],
                samples=[115, 118, 120, 122, 125],
                execution_class="toolchain",
            ),
            task(
                "linux",
                needs=["gate"],
                outputs=["linux-artifact"],
                samples=[580, 600, 620, 640, 660],
                execution_class="gradle-cache",
            ),
            task(
                "macos",
                needs=["gate"],
                outputs=["macos-proof"],
                samples=[650, 660, 670, 680, 690],
                execution_class="gradle-cache",
            ),
            task(
                "rust",
                needs=["gate"],
                outputs=["rust-artifact"],
                samples=[270, 275, 280, 285, 290],
                execution_class="toolchain",
            ),
            task(
                "oci-22",
                needs=["linux", "rust"],
                outputs=["oci-22-proof"],
                samples=[120, 125, 130, 135, 140],
                execution_class="oci",
            ),
            task(
                "oci-24",
                needs=["linux", "rust"],
                outputs=["oci-24-proof"],
                samples=[120, 125, 130, 135, 140],
                execution_class="oci",
            ),
            task(
                "action-runtime",
                needs=["linux", "rust"],
                outputs=["action-runtime-proof"],
                samples=[190, 195, 200, 205, 210],
                execution_class="artifact-consumer",
            ),
        ],
        "fanoutGateTaskIds": ["gate"],
        "observedWorkflowDurationSamplesSeconds": [860, 880, 900, 920, 940],
    }
    return {
        "$schema": "./workflow-graph-model.schema.json",
        "schemaVersion": 1,
        "baseline": baseline,
        "candidate": candidate,
        "expectations": {
            "outputEquivalence": "exact",
            "timingEvidenceMode": "blocking",
            "minimumCriticalPathReductionSeconds": 200,
            "maximumCandidateCriticalPathSeconds": 850,
            "minimumFanoutGateReductionSeconds": 90,
            "maximumCandidateFanoutGateSeconds": 10,
            "maximumCandidateTaskCountIncrease": 1,
            "maximumMedianModelDriftRatio": 0.15,
            "minimumTaskSamples": 5,
            "minimumWorkflowSamples": 5,
        },
    }


class WorkflowModelTests(unittest.TestCase):
    def test_representative_graph_proves_progress_and_output_equivalence(self) -> None:
        result = model.compare_document(representative_document())

        self.assertEqual(result["status"], "pass")
        self.assertTrue(result["comparison"]["outputEquivalent"])
        self.assertEqual(result["comparison"]["taskCountIncrease"], 1)
        self.assertGreaterEqual(
            result["comparison"]["criticalPathReductionSeconds"], 200
        )
        self.assertIn("macos", result["baseline"]["criticalPathTaskIds"])
        self.assertNotIn("macos", result["candidate"]["criticalPathTaskIds"])
        self.assertEqual(result["warnings"], [])

    def test_output_loss_fails_even_when_duration_improves(self) -> None:
        document = representative_document()
        candidate_tasks = document["candidate"]["tasks"]  # type: ignore[index]
        candidate_tasks[1]["outputs"] = ["replacement-runtime-contract"]  # type: ignore[index]

        result = model.compare_document(document)

        self.assertEqual(result["status"], "fail")
        self.assertFalse(result["comparison"]["outputEquivalent"])
        self.assertEqual(result["comparison"]["missingOutputIds"], ["runtime-contracts"])
        self.assertEqual(
            result["comparison"]["addedOutputIds"], ["replacement-runtime-contract"]
        )

    def test_cycle_is_rejected_before_duration_analysis(self) -> None:
        document = representative_document()
        baseline_tasks = document["baseline"]["tasks"]  # type: ignore[index]
        baseline_tasks[0]["needs"] = ["action-runtime"]  # type: ignore[index]

        with self.assertRaisesRegex(model.ModelError, "dependency cycle"):
            model.compare_document(document)

    def test_configured_sample_floor_is_blocking(self) -> None:
        document = representative_document()
        candidate_tasks = document["candidate"]["tasks"]  # type: ignore[index]
        candidate_tasks[0]["durationSamplesSeconds"] = [8]  # type: ignore[index]

        result = model.compare_document(document)

        self.assertEqual(result["status"], "fail")
        self.assertTrue(
            any("candidate tasks below minimumTaskSamples" in item for item in result["failures"])
        )

    def test_non_finite_duration_is_rejected(self) -> None:
        document = representative_document()
        candidate_tasks = document["candidate"]["tasks"]  # type: ignore[index]
        candidate_tasks[0]["durationSamplesSeconds"] = [float("nan")]  # type: ignore[index]

        with self.assertRaisesRegex(model.ModelError, "must be finite"):
            model.compare_document(document)

    def test_kast_observations_are_valid_but_explicitly_provisional(self) -> None:
        path = SKILL_ROOT / "references/kast-workflow-optimization-model.json"
        document = json.loads(path.read_text(encoding="utf-8"))

        result = model.compare_document(document)

        self.assertEqual(result["status"], "provisional")
        self.assertEqual(result["comparison"]["taskCountIncrease"], 1)
        self.assertGreaterEqual(
            result["comparison"]["criticalPathReductionSeconds"], 200
        )
        self.assertTrue(
            any("candidate task timing is provisional" in item for item in result["warnings"])
        )
        self.assertTrue(
            any("candidate workflow timing is provisional" in item for item in result["warnings"])
        )

    def test_schema_document_is_parseable_json(self) -> None:
        schema = SKILL_ROOT / "references/workflow-graph-model.schema.json"
        parsed = json.loads(schema.read_text(encoding="utf-8"))

        self.assertEqual(parsed["$schema"], "https://json-schema.org/draft/2020-12/schema")
        self.assertFalse(parsed["additionalProperties"])


if __name__ == "__main__":
    unittest.main()
