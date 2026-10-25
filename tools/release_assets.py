# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = []
# [tool.uv]
# no-build = true
# required-version = ">=0.12.9"
# [[tool.uv.index]]
# name = "pypi"
# url = "https://pypi.org/simple"
# default = true
# ///
"""Retain verified provider archives and create source-bound, immutable release tags."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import tarfile
from pathlib import Path

from tools.pi_candidate import (
    VERSION,
    CandidateError,
    Failure,
    listing,
    load,
    mapping,
    number_field,
    observe,
    require_identity,
    run_command,
    sequence,
    successful_run,
)

PROVIDERS = {"codex": ".agents/plugins", "github-copilot": ".github/plugin", "amp": ".amp/plugins"}
PROVIDER_SCHEMA = 2
MAX_BYTES = 64 * 1024 * 1024


def checksum(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def package(projections: Path, output: Path, revision: str, version: str) -> None:
    require_identity("amichne/slopsentral", revision)
    if not VERSION.fullmatch(version):
        raise CandidateError(Failure.INVALID_IDENTITY)
    output.mkdir(parents=True, exist_ok=False)
    archives: list[dict[str, object]] = []
    for harness, root in PROVIDERS.items():
        source = projections / harness
        if not (source / root / "marketplace.json").is_file():
            raise CandidateError(Failure.PAYLOAD_MISMATCH)
        filename = f"slopsentral-{harness}.tar.gz"
        archive = output / filename
        with (
            archive.open("xb") as raw,
            gzip.GzipFile(fileobj=raw, mode="wb", mtime=0, filename="") as zipped,
            tarfile.open(fileobj=zipped, mode="w") as packed,
        ):
            for path in sorted((source / root).rglob("*")):
                if path.is_symlink() or not (path.is_file() or path.is_dir()):
                    raise CandidateError(Failure.PAYLOAD_MISMATCH)
                info = packed.gettarinfo(str(path), arcname=path.relative_to(source).as_posix())
                info.uid = info.gid = info.mtime = 0
                info.uname = info.gname = ""
                if path.is_file():
                    with path.open("rb") as payload:
                        packed.addfile(info, payload)
                else:
                    packed.addfile(info)
        archives.append(
            {
                "harness": harness,
                "file": filename,
                "sha256": checksum(archive),
                "size": archive.stat().st_size,
            }
        )
    _ = (output / "release-assets.json").write_text(
        json.dumps(
            {
                "schema_version": PROVIDER_SCHEMA,
                "source_revision": revision,
                "version": version,
                "archives": archives,
            },
            indent=2,
        )
        + "\n"
    )
    _ = (output / "SHA256SUMS").write_text(
        "".join(f"{entry['sha256']}  {entry['file']}\n" for entry in archives)
    )
    _ = inspect(output, revision, version)


def inspect(bundle: Path, revision: str, version: str) -> tuple[Path, ...]:
    require_identity("amichne/slopsentral", revision)
    value = load((bundle / "release-assets.json").read_bytes())
    if (
        not mapping(value)
        or set(value) != {"schema_version", "source_revision", "version", "archives"}
        or value["schema_version"] != PROVIDER_SCHEMA
        or value["source_revision"] != revision
        or value["version"] != version
        or not sequence(entries := value["archives"])
        or len(entries) != len(PROVIDERS)
    ):
        raise CandidateError(Failure.INVALID_RECORD)
    archives: list[Path] = []
    checksums = ""
    for entry, (harness, root) in zip(entries, PROVIDERS.items(), strict=True):
        if (
            not mapping(entry)
            or set(entry) != {"harness", "file", "sha256", "size"}
            or entry["harness"] != harness
            or entry["file"] != f"slopsentral-{harness}.tar.gz"
            or not isinstance(entry["sha256"], str)
            or not re.fullmatch(r"[a-f0-9]{64}", entry["sha256"])
        ):
            raise CandidateError(Failure.INVALID_RECORD)
        archive = bundle / str(entry["file"])
        if (
            archive.is_symlink()
            or not archive.is_file()
            or archive.stat().st_size != entry["size"]
            or archive.stat().st_size > MAX_BYTES
            or checksum(archive) != entry["sha256"]
        ):
            raise CandidateError(Failure.PAYLOAD_MISMATCH)
        inspect_archive(archive, root, harness, version)
        archives.append(archive)
        checksums += f"{entry['sha256']}  {entry['file']}\n"
    if (
        (bundle / "SHA256SUMS").read_text() != checksums
        or {path.name for path in bundle.iterdir()}
        != {"release-assets.json", "SHA256SUMS", *(archive.name for archive in archives)}
        or any(path.is_symlink() or not path.is_file() for path in bundle.iterdir())
    ):
        raise CandidateError(Failure.PAYLOAD_MISMATCH)
    return tuple(archives)


def inspect_archive(archive: Path, root: str, harness: str, version: str) -> None:
    with tarfile.open(archive) as packed:
        members = packed.getmembers()
        if (
            sum(member.size for member in members) > MAX_BYTES
            or not any(
                member.name == f"{root}/marketplace.json" and member.isfile() for member in members
            )
            or len({member.name for member in members}) != len(members)
        ):
            raise CandidateError(Failure.PAYLOAD_MISMATCH)
        suffix = (
            "/.codex-plugin/plugin.json"
            if harness == "codex"
            else "/plugin.json"
            if harness == "github-copilot"
            else "/package.json"
        )
        manifest_depth = 2 if harness == "codex" else 1
        manifests: list[str] = []
        for member in members:
            path = Path(member.name)
            if (
                path.is_absolute()
                or ".." in path.parts
                or not member.name.startswith(f"{root}/")
                or not (member.isfile() or member.isdir())
            ):
                raise CandidateError(Failure.PAYLOAD_MISMATCH)
            relative = member.name.removeprefix(root + "/")
            if relative.endswith(suffix) and relative.count("/") == manifest_depth:
                stream = packed.extractfile(member)
                if stream is None or member.size > 64 * 1024:
                    raise CandidateError(Failure.PAYLOAD_MISMATCH)
                manifest = load(stream.read())
                if not mapping(manifest) or manifest.get("version") != version:
                    raise CandidateError(Failure.PAYLOAD_MISMATCH)
                manifests.append(member.name)
        if not manifests:
            raise CandidateError(Failure.PAYLOAD_MISMATCH)


def admit_run(repository: str, run_id: int, revision: str) -> str:
    require_identity(repository, revision)
    run = successful_run(observe(f"repos/{repository}/actions/runs/{run_id}"), repository, revision)
    if run.get("event") != "push" or run.get("head_branch") != "main":
        raise CandidateError(Failure.WRONG_PRODUCER)
    attempt = number_field(run, "run_attempt")
    artifacts = listing(
        observe(f"repos/{repository}/actions/runs/{run_id}/artifacts?per_page=100"), "artifacts"
    )
    # A failed-job-only retry can retain an earlier successful validate job.
    matches: dict[int, str] = {}
    for artifact in artifacts:
        name = artifact.get("name")
        if not isinstance(name, str) or artifact.get("expired") is not False:
            continue
        selected = re.fullmatch(rf"marketplace-candidate-{revision}-([1-9][0-9]*)", name)
        if selected is None or int(selected[1]) > attempt:
            continue
        producer_attempt = int(selected[1])
        if producer_attempt in matches:
            raise CandidateError(Failure.INVALID_RECORD)
        matches[producer_attempt] = name
    if not matches:
        raise CandidateError(Failure.INVALID_RECORD)
    return matches[max(matches)]


def ensure_tag(repository: str, tag: str, revision: str) -> None:
    require_identity(repository, revision)
    if not tag.startswith("slopsentral-v") or not VERSION.fullmatch(
        tag.removeprefix("slopsentral-v")
    ):
        raise CandidateError(Failure.INVALID_IDENTITY)
    existing = run_command(
        ["git", "ls-remote", f"https://github.com/{repository}.git", f"refs/tags/{tag}"]
    )
    if existing:
        if existing.split() != [revision, f"refs/tags/{tag}"]:
            raise CandidateError(Failure.WRONG_PRODUCER)
        return
    _ = run_command(
        [
            "gh",
            "api",
            "--method",
            "POST",
            f"repos/{repository}/git/refs",
            "-f",
            f"ref=refs/tags/{tag}",
            "-f",
            f"sha={revision}",
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("package")
    _ = build.add_argument("projections", type=Path)
    _ = build.add_argument("output", type=Path)
    _ = build.add_argument("revision")
    _ = build.add_argument("version")
    verify = sub.add_parser("verify")
    _ = verify.add_argument("bundle", type=Path)
    _ = verify.add_argument("revision")
    _ = verify.add_argument("version")
    admit = sub.add_parser("admit-run")
    _ = admit.add_argument("repository")
    _ = admit.add_argument("run_id", type=int)
    _ = admit.add_argument("revision")
    _ = admit.add_argument("--github-output", type=Path, required=True)
    tag = sub.add_parser("ensure-tag")
    _ = tag.add_argument("repository")
    _ = tag.add_argument("tag")
    _ = tag.add_argument("revision")
    args = parser.parse_args()
    try:
        if args.command == "package":
            package(
                Path(args.projections), Path(args.output), str(args.revision), str(args.version)
            )
        elif args.command == "verify":
            _ = inspect(Path(args.bundle), str(args.revision), str(args.version))
        elif args.command == "admit-run":
            name = admit_run(str(args.repository), int(args.run_id), str(args.revision))
            with Path(args.github_output).open("a") as output:
                _ = output.write(f"artifact={name}\n")
        else:
            ensure_tag(str(args.repository), str(args.tag), str(args.revision))
    except CandidateError as error:
        parser.exit(1, f"release-assets: {error}\n")
    except OSError:
        parser.exit(1, f"release-assets: {Failure.EFFECT_FAILED.value}\n")
    except (ValueError, tarfile.TarError):
        parser.exit(1, f"release-assets: {Failure.INVALID_RECORD.value}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
