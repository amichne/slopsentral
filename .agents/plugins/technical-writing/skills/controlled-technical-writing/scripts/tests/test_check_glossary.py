import subprocess
import sys
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "check_glossary.py"


class CheckGlossaryTest(unittest.TestCase):
    def test_packaged_self_test_passes(self) -> None:
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--self-test"],
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Self-test passed.", result.stdout)


if __name__ == "__main__":
    unittest.main()
