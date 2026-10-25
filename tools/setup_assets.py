"""Keep the consumer installer bound to the qualified Pi candidate."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from tools.pi_candidate import (
    CandidateError,
    Failure,
    digest,
    listing,
    mapping,
    number_field,
    observe,
    read,
    require_identity,
    require_record,
    successful_run,
)

ROOT = Path(__file__).resolve().parents[1]
FILES = ("install-pi.sh", "setup-pi.mts")


def package(source: Path, candidate: Path, output: Path) -> None:
    admitted = read(candidate)
    require_identity(admitted.repository, admitted.source_revision)
    output.mkdir(parents=True, exist_ok=False)
    records: list[dict[str, object]] = []
    for name in FILES:
        origin = source / "tools" / name
        if origin.is_symlink() or not origin.is_file():
            raise CandidateError(Failure.PAYLOAD_MISMATCH)
        target = output / name
        _ = target.write_bytes(origin.read_bytes())
        records.append({"file": name, "sha256": digest(target), "size": target.stat().st_size})
    value = {
        "schema_version": admitted.schema_version,
        "repository": admitted.repository,
        "source_revision": admitted.source_revision,
        "version": admitted.version,
        "candidate_sha256": digest(candidate / "candidate.json"),
        "files": records,
    }
    _ = (output / "setup.json").write_text(json.dumps(value, indent=2) + "\n")
    _ = (output / "SHA256SUMS").write_text(
        "".join(f"{digest(output / name)}  {name}\n" for name in (*FILES, "setup.json"))
    )
    verify(output, candidate / "candidate.json")


def verify(bundle: Path, candidate: Path) -> None:
    admitted = require_record(json.loads(candidate.read_bytes()))
    value: object = json.loads((bundle / "setup.json").read_bytes())
    if (
        not mapping(value)
        or set(value)
        != {
            "schema_version",
            "repository",
            "source_revision",
            "version",
            "candidate_sha256",
            "files",
        }
        or value["schema_version"] != admitted.schema_version
        or value["repository"] != admitted.repository
        or value["source_revision"] != admitted.source_revision
        or value["version"] != admitted.version
        or value["candidate_sha256"] != digest(candidate)
        or value["files"]
        != [
            {"file": name, "sha256": digest(bundle / name), "size": (bundle / name).stat().st_size}
            for name in FILES
        ]
        or {file.name for file in bundle.iterdir()} != {*FILES, "setup.json", "SHA256SUMS"}
        or any(file.is_symlink() or not file.is_file() for file in bundle.iterdir())
        or (bundle / "SHA256SUMS").read_text()
        != "".join(f"{digest(bundle / name)}  {name}\n" for name in (*FILES, "setup.json"))
    ):
        raise CandidateError(Failure.PAYLOAD_MISMATCH)


def admit(repository: str, run_id: int, revision: str) -> str:
    require_identity(repository, revision)
    producer = successful_run(
        observe(f"repos/{repository}/actions/runs/{run_id}"), repository, revision
    )
    if producer.get("event") != "push" or producer.get("head_branch") != "main":
        raise CandidateError(Failure.WRONG_PRODUCER)
    attempt = number_field(producer, "run_attempt")
    expected = f"setup-candidate-{revision}-{attempt}"
    candidates = listing(
        observe(f"repos/{repository}/actions/runs/{run_id}/artifacts?per_page=100"), "artifacts"
    )
    matching = [item for item in candidates if item.get("name") == expected]
    if len(matching) != 1 or matching[0].get("expired") is not False:
        raise CandidateError(Failure.WRONG_PRODUCER)
    return expected


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("package")
    _ = build.add_argument("candidate", type=Path)
    _ = build.add_argument("output", type=Path)
    _ = build.add_argument("--source", type=Path, default=ROOT)
    check = sub.add_parser("verify")
    _ = check.add_argument("bundle", type=Path)
    _ = check.add_argument("candidate", type=Path)
    admission = sub.add_parser("admit-run")
    _ = admission.add_argument("repository")
    _ = admission.add_argument("run_id", type=int)
    _ = admission.add_argument("revision")
    _ = admission.add_argument("--github-output", type=Path, required=True)
    args = parser.parse_args()
    try:
        match args.command:
            case "package":
                package(Path(args.source), Path(args.candidate), Path(args.output))
            case "verify":
                verify(Path(args.bundle), Path(args.candidate))
            case "admit-run":
                name = admit(str(args.repository), int(args.run_id), str(args.revision))
                with Path(args.github_output).open("a") as target:
                    _ = target.write(f"artifact={name}\n")
            case _:
                parser.error("Unknown setup asset operation")
    except CandidateError as error:
        print(json.dumps({"type": "SETUP_REJECTED", "reason": error.failure.value}))
        return 1
    except (OSError, ValueError):
        print(json.dumps({"type": "SETUP_REJECTED", "reason": "INVALID_RECORD"}))
        return 1

    else:
        print(json.dumps({"type": "SETUP_VERIFIED"}))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
