from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_compiler_runner_reaches_retained_proof_checker(tmp_path: Path) -> None:
    compiler = tmp_path / "kotlinc"
    _ = compiler.write_text(
        f"#!{sys.executable}\n"
        "import sys\n"
        "if any('non-exhaustive-sealed-when.fail.kt' in arg for arg in sys.argv):\n"
        "    print('when must be exhaustive', file=sys.stderr)\n"
        "    sys.exit(1)\n"
    )
    compiler.chmod(0o755)
    node = tmp_path / "node"
    _ = node.write_text(
        f"#!{sys.executable}\n"
        "import pathlib, sys\n"
        f"expected = pathlib.Path({str(ROOT / 'tools/check-proof-examples.mjs')!r})\n"
        "assert pathlib.Path(sys.argv[1]) == expected, sys.argv\n"
        "assert expected.is_file()\n"
        "print('RETAINED_CHECKER_REACHED')\n"
    )
    node.chmod(0o755)
    result = subprocess.run(
        [sys.executable, str(ROOT / "tools/compile_kotlin_concepts.py"), str(compiler)],
        env=os.environ | {"PATH": f"{tmp_path}{os.pathsep}{os.environ['PATH']}"},
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "RETAINED_CHECKER_REACHED" in result.stdout
