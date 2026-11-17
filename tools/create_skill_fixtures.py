"""Create the disposable repositories and pinned registry for the four skill regressions."""

import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("out", type=Path, help="new directory for fixture sources and registry")
    out: Path = parser.parse_args().out.resolve()
    out.mkdir()
    source = Path(__file__).resolve().parent / "promptfoo" / "fixtures"
    verifier = out / "verify.mjs"
    _ = shutil.copyfile(source / verifier.name, verifier)
    revision_cases = {
        "software-engineering/smallest-heap-proof": ("heap", "heap-process"),
        "software-engineering/ci-failed-producer-fanout": ("graph", "log"),
        "software-engineering/installed-harness-proof-replacement": (
            "probes",
            "acceptance",
            "component-harness",
        ),
        "kotlin-engineering/gradle-native-report-fallback": ("timing", "compiler"),
    }
    fixtures: list[dict[str, object]] = []
    for case_id, commands in revision_cases.items():
        repository = out / case_id.split("/")[1]
        repository.mkdir()
        _ = shutil.copyfile(source / "checks.mjs", repository / "checks.mjs")
        _ = shutil.copyfile(source / "installed.mjs", repository / "installed.mjs")
        _ = subprocess.run(["git", "init", "--quiet", repository], check=True)
        _ = subprocess.run(["git", "-C", repository, "add", "."], check=True)
        _ = subprocess.run(
            [
                "git",
                "-C",
                repository,
                "-c",
                "user.name=Fixture",
                "-c",
                "user.email=fixture@example.invalid",
                "-c",
                "commit.gpgsign=false",
                "-c",
                "core.hooksPath=/dev/null",
                "commit",
                "--quiet",
                "-m",
                "Add inputs",
            ],
            check=True,
        )
        revision = subprocess.check_output(
            ["git", "-C", repository, "rev-parse", "HEAD"], text=True
        ).strip()
        allowed = [f"node ./checks.mjs {command}" for command in commands]
        fixtures.append(
            {
                "caseId": case_id,
                "repository": str(repository),
                "revision": revision,
                "context": "Available literal shell commands:\n" + "\n".join(allowed),
                "ampCommands": allowed,
                "verifier": {
                    "file": str(verifier),
                    "sha256": "sha256:" + hashlib.sha256(verifier.read_bytes()).hexdigest(),
                },
            }
        )
    _ = (out / "fixtures.json").write_text(json.dumps(fixtures, indent=2) + "\n")


if __name__ == "__main__":
    main()
