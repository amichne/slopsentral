from __future__ import annotations

import importlib.util
from importlib.machinery import SourceFileLoader
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "required-skill-read.py"
LOADER = SourceFileLoader("required_skill_read", str(MODULE_PATH))
SPEC = importlib.util.spec_from_loader(LOADER.name, LOADER)
assert SPEC is not None
assert SPEC.loader is not None
required_skill_read = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(required_skill_read)


class RequiredSkillReadTest(unittest.TestCase):
    def test_read_command_records_the_required_skill(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory).resolve()
            skill = repo / "skills/example/SKILL.md"
            skill.parent.mkdir(parents=True)
            skill.write_text("# Example\n", encoding="utf-8")
            required = [{"absolutePath": skill}]
            payload = {
                "toolName": "functions.exec_command",
                "toolArgs": {"cmd": "sed -n '1,200p' skills/example/SKILL.md"},
            }

            reads = required_skill_read.skill_reads_from_payload(repo, payload, required)

        self.assertEqual(reads, {str(skill)})

    def test_write_command_does_not_count_as_a_skill_read(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory).resolve()
            skill = repo / "skills/example/SKILL.md"
            skill.parent.mkdir(parents=True)
            skill.write_text("# Example\n", encoding="utf-8")
            payload = {
                "toolName": "functions.exec_command",
                "toolArgs": {"cmd": "sed -n '1,200p' skills/example/SKILL.md > copy.md"},
            }

            observed = required_skill_read.payload_references_path(repo, payload, skill)

        self.assertFalse(observed)

    def test_parallel_payload_keeps_nested_read_detection(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory).resolve()
            skill = repo / "skills/example/SKILL.md"
            skill.parent.mkdir(parents=True)
            skill.write_text("# Example\n", encoding="utf-8")
            payload = {
                "toolName": "multi_tool_use.parallel",
                "toolArgs": {
                    "tool_uses": [
                        {
                            "recipient_name": "functions.exec_command",
                            "parameters": {"cmd": "cat skills/example/SKILL.md"},
                        }
                    ]
                },
            }

            observed = required_skill_read.payload_references_path(repo, payload, skill)

        self.assertTrue(observed)


if __name__ == "__main__":
    unittest.main()
