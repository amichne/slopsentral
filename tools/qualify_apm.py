#!/usr/bin/env -S uv run --locked --script
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
"""Qualify APM's local Codex bundle transport without a model or active user state."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import tempfile
import tomllib
import urllib.error
import urllib.request
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime
from pathlib import Path
from typing import TYPE_CHECKING, TypeGuard

if TYPE_CHECKING:
    from collections.abc import Mapping

PLUGINS = (
    "developer-tooling",
    "intellij-plugin-development",
    "kotlin-engineering",
    "repository-knowledge",
    "software-engineering",
)


class QualificationError(ValueError):
    """An observed boundary did not establish the requested invariant."""


def require(condition: object, message: str) -> None:
    if condition is not True:
        raise QualificationError(message)


def mapping(value: object) -> TypeGuard[Mapping[object, object]]:
    return isinstance(value, dict)


def sequence(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def object_at(value: object) -> dict[str, object]:
    if not mapping(value):
        message = "Expected a JSON object"
        raise QualificationError(message)
    result: dict[str, object] = {}
    for key, item in value.items():
        require(isinstance(key, str), "Expected string object keys")
        if isinstance(key, str):
            result[key] = item
    return result


def read_object(path: Path) -> dict[str, object]:
    return object_at(json.loads(path.read_text(encoding="utf-8")))


def inventory(root: Path) -> dict[str, tuple[str, bool]]:
    """Independently compare every payload file and executable bit, including locks."""
    require(root.is_dir() and not root.is_symlink(), f"Not a regular bundle: {root}")
    result: dict[str, tuple[str, bool]] = {}
    for path in sorted(root.rglob("*")):
        require(not path.is_symlink(), f"Symlink in bundle: {path}")
        if path.is_file():
            result[path.relative_to(root).as_posix()] = (
                hashlib.sha256(path.read_bytes()).hexdigest(),
                bool(path.stat().st_mode & 0o111),
            )
        else:
            require(path.is_dir(), f"Special file in bundle: {path}")
    require(bool(result), f"Empty bundle: {root}")
    return result


def context_response(stdout: str, expected: str) -> None:
    response = object_at(json.loads(stdout))
    hook = object_at(response.get("hookSpecificOutput"))
    require(hook.get("hookEventName") == "SessionStart", "Wrong hook event")
    require(hook.get("additionalContext") == expected, "Bundled policy was not delivered")
    require(response.get("continue") is not False, "Hook refused delivery")


def failure_response(stdout: str, code: str) -> None:
    response = object_at(json.loads(stdout))
    require(response.get("continue") is False, "Hook failure did not refuse delivery")
    reason = response.get("stopReason")
    require(isinstance(reason, str) and code in reason, f"Missing failure code: {code}")
    require("hookSpecificOutput" not in response, "Failure also claimed policy delivery")


ROLES = ("apm", "codex", "uv")
VERSION = r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)"
DEFAULT_COMPATIBILITY = Path(__file__).resolve().with_name("apm-compatibility.json")
RELEASES = {
    "apm": ("https://api.github.com/repos/microsoft/apm/releases/latest", "v"),
    "codex": ("https://api.github.com/repos/openai/codex/releases/latest", "rust-v"),
    "uv": ("https://api.github.com/repos/astral-sh/uv/releases/latest", ""),
}


def stable_version(value: object) -> str:
    require(
        isinstance(value, str) and re.fullmatch(VERSION, value) is not None,
        "Expected an exact stable version",
    )
    return str(value)


@dataclass(frozen=True)
class Versions:
    apm: str
    codex: str
    uv: str

    @classmethod
    def parse(cls, value: object) -> Versions:
        data = object_at(value)
        require(set(data) == set(ROLES), "Expected exactly apm, codex, and uv versions")
        return cls(*(stable_version(data[name]) for name in ROLES))

    def data(self) -> dict[str, str]:
        return {"apm": self.apm, "codex": self.codex, "uv": self.uv}


@dataclass(frozen=True)
class Compatibility:
    qualified: Versions
    latest: Versions
    checked_at: str
    upstream_apm: str
    upstream_codex: str
    source_commit: str

    @classmethod
    def parse(cls, value: object) -> Compatibility:
        data = object_at(value)
        require(
            set(data)
            == {
                "$schema",
                "schemaVersion",
                "qualified",
                "latestObserved",
                "upstreamCodexAdmission",
            },
            "Unsupported compatibility fields",
        )
        require(
            data["$schema"] == "../source/schemas/apm/compatibility.schema.json"
            and type(data["schemaVersion"]) is int
            and data["schemaVersion"] == 1,
            "Unsupported compatibility schema",
        )
        latest = object_at(data["latestObserved"])
        require(set(latest) == {*ROLES, "checkedAt"}, "Unsupported release observation fields")
        checked_at = str(latest["checkedAt"])
        require(
            date.fromisoformat(checked_at).isoformat() == checked_at,
            "Expected an ISO observation date",
        )
        upstream = object_at(data["upstreamCodexAdmission"])
        require(
            set(upstream) == {"apm", "codex", "sourceCommit", "sourceUrl"},
            "Unsupported admission evidence fields",
        )
        commit = str(upstream["sourceCommit"])
        require(
            re.fullmatch(r"[0-9a-f]{40}", commit) is not None,
            "Expected an immutable upstream source commit",
        )
        require(
            upstream["sourceUrl"]
            == f"https://github.com/microsoft/apm/blob/{commit}/src/apm_cli/codex_plugins/client.py",
            "Admission URL and source commit differ",
        )
        return cls(
            Versions.parse(data["qualified"]),
            Versions.parse({name: latest[name] for name in ROLES}),
            checked_at,
            stable_version(upstream["apm"]),
            stable_version(upstream["codex"]),
            commit,
        )

    def data(self) -> dict[str, object]:
        return {
            "$schema": "../source/schemas/apm/compatibility.schema.json",
            "schemaVersion": 1,
            "qualified": self.qualified.data(),
            "latestObserved": {"checkedAt": self.checked_at, **self.latest.data()},
            "upstreamCodexAdmission": {
                "apm": self.upstream_apm,
                "codex": self.upstream_codex,
                "sourceCommit": self.source_commit,
                "sourceUrl": f"https://github.com/microsoft/apm/blob/{self.source_commit}/src/apm_cli/codex_plugins/client.py",
            },
        }


def compatibility_at(path: Path) -> tuple[Compatibility, str]:
    raw = path.read_bytes()
    return Compatibility.parse(json.loads(raw)), hashlib.sha256(raw).hexdigest()


def write_new_json(path: Path, value: dict[str, object]) -> None:
    with path.open("x", encoding="utf-8") as stream:
        _ = stream.write(json.dumps(value, indent=2) + "\n")


def release_version(role: str, value: object) -> str:
    data = object_at(value)
    require(
        data.get("draft") is False and data.get("prerelease") is False,
        "Latest release must be stable and published",
    )
    tag = data.get("tag_name")
    prefix = RELEASES[role][1]
    require(isinstance(tag, str) and tag.startswith(prefix), "Unexpected release tag")
    return stable_version(str(tag).removeprefix(prefix))


def fetch_latest(role: str) -> str:
    request = urllib.request.Request(  # noqa: S310 -- role selects a fixed official HTTPS endpoint
        RELEASES[role][0],
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "slopsentral-apm-qualification",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310 -- fixed official HTTPS release endpoints
        raw = response.read(2 * 1024 * 1024 + 1)
    require(len(raw) <= 2 * 1024 * 1024, "Release metadata exceeds the evidence limit")
    return release_version(role, json.loads(raw))


def refresh_latest(record: Compatibility) -> Compatibility:
    return replace(
        record,
        latest=Versions(*(fetch_latest(role) for role in ROLES)),
        checked_at=datetime.now(UTC).date().isoformat(),
    )


def propose_pins(record: Compatibility, digest: str, report: dict[str, object]) -> Compatibility:
    require(
        report.get("status") == "CANDIDATE_QUALIFIED_MECHANISMS"
        and report.get("mode") == "candidate",
        "Candidate did not pass; no pin proposal is permitted",
    )
    require(
        report.get("compatibilitySha256") == digest,
        "Compatibility record changed since the candidate run",
    )
    require(
        report.get("qualifierSha256") == hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "Qualifier changed since the candidate run",
    )
    for key in (
        "native_transport",
        "direct_session_start",
        "frozen",
        "owned_cleanup",
        "approval_and_scope_refusal",
    ):
        require(report.get(key) == "PASS", f"Candidate is missing proof: {key}")
    require(
        report.get("loose_copilot") == "UNSUPPORTED_REPRODUCED",
        "Candidate is missing the loose conversion control",
    )
    observations = object_at(report.get("observedVersions"))
    pins = Versions.parse({name: observations.get(name) for name in ROLES})
    hashes = object_at(report.get("executable_sha256"))
    require(
        set(hashes) == {*ROLES, "python"}
        and all(
            isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None
            for value in hashes.values()
        ),
        "Candidate is missing executable identities",
    )
    files = object_at(report.get("files"))
    require(
        set(files) == set(PLUGINS)
        and all(type(count) is int and count > 0 for count in files.values()),
        "Candidate is missing the complete payload inventory",
    )
    return replace(record, qualified=pins)


@dataclass(frozen=True)
class UpstreamRefusal:
    required_codex: str


def upstream_refusal(
    result: subprocess.CompletedProcess[str], observed_codex: str
) -> UpstreamRefusal | None:
    text = " ".join((result.stdout + result.stderr).split())
    match = re.search(
        r"Codex native registration is qualified only for Codex CLI (" + VERSION + r")\.", text
    )
    if result.returncode != 0 and match is not None and match[1] != observed_codex:
        return UpstreamRefusal(match[1])
    return None


def observed_version(role: str, stdout: str) -> str:
    patterns = {
        "apm": r"Agent Package Manager \(APM\) CLI version (" + VERSION + r")(?: \([^\n]*\))?",
        "codex": r"codex-cli (" + VERSION + r")",
        "uv": r"uv (" + VERSION + r")(?: \([^\n]*\))?",
        "python": r"Python (" + VERSION + r")",
    }
    match = re.fullmatch(patterns[role], stdout.strip())
    require(match is not None, f"Cannot establish actual {role} version")
    if match is None:
        message = f"Cannot establish actual {role} version"
        raise QualificationError(message)
    return stable_version(match[1])


@dataclass(frozen=True)
class Programs:
    apm: Path
    codex: Path
    uv: Path
    python: Path


@dataclass(frozen=True)
class Trial:
    root: Path
    programs: Programs
    environment: dict[str, str]

    @classmethod
    def create(cls, root: Path, programs: Programs) -> Trial:
        root.mkdir()
        home = root / "home"
        (home / ".codex").mkdir(parents=True)
        (home / ".apm").mkdir()
        binary = root / "bin"
        binary.mkdir()
        for name, path in (("codex", programs.codex), ("uv", programs.uv)):
            (binary / name).symlink_to(path)
        environment = {
            "HOME": str(home),
            "USERPROFILE": str(home),
            "CODEX_HOME": str(home / ".codex"),
            "APM_HOME": str(home / ".apm"),
            "XDG_CONFIG_HOME": str(home / ".config"),
            "XDG_CACHE_HOME": str(home / ".cache"),
            "XDG_DATA_HOME": str(home / ".local/share"),
            "UV_CACHE_DIR": str(home / ".cache/uv"),
            "UV_PYTHON": str(programs.python),
            "UV_PYTHON_DOWNLOADS": "never",
            "UV_OFFLINE": "1",
            "PATH": f"{binary}:/usr/bin:/bin:/usr/sbin:/sbin",
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_ALLOW_PROTOCOL": "file",
            "LANG": "en_US.UTF-8",
            "NO_COLOR": "1",
        }
        return cls(root, programs, environment)

    @property
    def apm_home(self) -> Path:
        return Path(self.environment["APM_HOME"])

    @property
    def config(self) -> Path:
        return Path(self.environment["CODEX_HOME"]) / "config.toml"

    @property
    def journal(self) -> Path:
        return self.apm_home / ".codex-native/ownership.json"

    def run(
        self,
        label: str,
        argv: list[str],
        *,
        stdin: str | None = None,
        extra: dict[str, str] | None = None,
    ) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            argv,
            cwd=self.root,
            env={**self.environment, **(extra or {})},
            input=stdin,
            text=True,
            capture_output=True,
            timeout=90,
            check=False,
        )
        _ = (self.root / f"{label}.json").write_text(
            json.dumps(
                {
                    "argv": argv,
                    "exit": result.returncode,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        return result

    def apm(
        self, label: str, *arguments: str, success: bool = True
    ) -> subprocess.CompletedProcess[str]:
        result = self.run(label, [str(self.programs.apm), *arguments])
        require(
            (result.returncode == 0) == success,
            f"Unexpected APM outcome: {label}; inspect its JSON log",
        )
        return result

    def declare(self, sources: list[Path], *, approved: bool) -> None:
        document: dict[str, object] = {
            "name": "slopsentral-apm-qualification",
            "version": "1.0.0",
            "dependencies": {"apm": [str(source) for source in sources]},
            "allowExecutables": {str(source): {"hooks": True} for source in sources}
            if approved
            else {},
        }
        _ = (self.apm_home / "apm.yml").write_text(json.dumps(document), encoding="utf-8")


def one_item(value: object) -> object:
    if not sequence(value):
        message = "Expected a single-item list"
        raise QualificationError(message)
    require(len(value) == 1, "Expected a single-item list")
    return value[0]


def hook_probe(trial: Trial, installed: Path) -> None:
    declaration = read_object(installed / "hooks/software-engineering-context.hooks.json")
    hooks = one_item(object_at(declaration["hooks"])["SessionStart"])
    commands = one_item(object_at(hooks)["hooks"])
    command = object_at(commands)["command"]
    if not isinstance(command, str):
        message = "Missing hook command"
        raise QualificationError(message)
    expected = "\n\n".join(
        (installed / f"instructions/{name}.md").read_text(encoding="utf-8").strip()
        for name in ("agent-execution", "engineering-design")
    )
    event = json.dumps(
        {"hook_event_name": "SessionStart", "session_id": "apm-qualification", "source": "startup"}
    )
    result = trial.run(
        "hook-context",
        ["/bin/sh", "-c", command],
        stdin=event,
        extra={"PLUGIN_ROOT": str(installed)},
    )
    require(result.returncode == 0, "Installed hook command failed")
    context_response(result.stdout, expected)
    failure = trial.run(
        "hook-missing-root",
        [
            str(trial.programs.uv),
            "run",
            "--locked",
            "--script",
            str(installed / "hooks/inject-instruction-context.py"),
            "--instruction",
            "agent-execution",
        ],
        stdin=event,
    )
    require(failure.returncode == 0, "Failure probe did not reach the JSON hook protocol")
    failure_response(failure.stdout, "INVALID_PLUGIN_ROOT")
    malformed = trial.run(
        "hook-invalid-event",
        ["/bin/sh", "-c", command],
        stdin="{}",
        extra={"PLUGIN_ROOT": str(installed)},
    )
    failure_response(malformed.stdout, "INVALID_EVENT")


def check_catalog(source: Path) -> None:
    catalog = read_object(source / ".agents/plugins/marketplace.json")["plugins"]
    require(sequence(catalog), "Missing native marketplace plugins")
    if not sequence(catalog):
        message = "Missing native marketplace plugins"
        raise QualificationError(message)
    require(
        sorted(str(object_at(entry)["name"]) for entry in catalog) == sorted(PLUGINS),
        "Catalog changed; reassess the qualification scope",
    )


def install_native(trial: Trial, codex_version: str) -> UpstreamRefusal | None:
    before = trial.config.read_bytes()
    install = trial.run("install", [str(trial.programs.apm), "install", "-g", "--target", "codex"])
    refusal = upstream_refusal(install, codex_version)
    if refusal is not None:
        require(
            trial.config.read_bytes() == before and not trial.journal.exists(),
            "Upstream refusal changed native state",
        )
        return refusal
    require(install.returncode == 0, "Native installation failed; inspect install.json")
    return None


def native_trial(
    trial: Trial, source: Path, codex_version: str
) -> dict[str, object] | UpstreamRefusal:
    check_catalog(source)
    sources = [source / ".agents/plugins" / name for name in PLUGINS]
    expected = {name: inventory(path) for name, path in zip(PLUGINS, sources, strict=True)}
    _ = trial.config.write_text(
        'model = "qualification-sentinel"\n[plugins."foreign@external"]\nenabled = false\n',
        encoding="utf-8",
    )
    trial.declare(sources, approved=True)
    refusal = install_native(trial, codex_version)
    if refusal is not None:
        return refusal
    records = object_at(read_object(trial.journal)["plugins"])
    require(len(records) == len(PLUGINS), "Missing native registrations")
    installed_roots: dict[str, Path] = {}
    for record in records.values():
        item = object_at(record)
        name = str(item["name"])
        installed = Path(str(item["installed_root"]))
        require(
            installed.is_relative_to(Path(trial.environment["CODEX_HOME"])),
            "Native copy escaped disposable home",
        )
        require(item["pending"] is False, "Registration remains pending")
        require(
            name in expected and inventory(installed) == expected[name],
            f"Incomplete native payload: {name}",
        )
        installed_roots[name] = installed
    config = tomllib.loads(trial.config.read_text(encoding="utf-8"))
    plugins = object_at(config["plugins"])
    require(len(plugins) == len(PLUGINS) + 1, "Unexpected native plugin set")
    require(
        all(value == {"enabled": False} for value in plugins.values()), "Install changed activation"
    )
    require(
        not list((Path(trial.environment["HOME"]) / ".agents/skills").glob("*")),
        "Native install also deployed loose skills",
    )
    hook_probe(trial, installed_roots["software-engineering"])
    _ = (trial.root / "inventory.json").write_text(json.dumps(expected, indent=2), encoding="utf-8")
    before = (trial.config.read_bytes(), trial.journal.read_bytes())
    _ = trial.apm("frozen", "install", "-g", "--frozen", "--target", "codex")
    require(
        before == (trial.config.read_bytes(), trial.journal.read_bytes()),
        "Frozen reinstall changed native state",
    )
    # This fixture owns its entire home. An explicit activation must prevent APM removal.
    original = trial.config.read_text(encoding="utf-8")
    owned_key = next(key for key in plugins if key.startswith(PLUGINS[0] + "@"))
    owned_table = f'[plugins."{owned_key}"]\n'
    require(owned_table + "enabled = false" in original, "Missing owned configuration fixture")
    _ = trial.config.write_text(
        original.replace(owned_table + "enabled = false", owned_table + "enabled = true", 1),
        encoding="utf-8",
    )
    customized = trial.config.read_bytes()
    _ = trial.apm("frozen-active", "install", "-g", "--frozen", "--target", "codex")
    require(trial.config.read_bytes() == customized, "Reinstall changed explicit activation")
    manifest = (trial.apm_home / "apm.yml").read_bytes()
    rejected = trial.apm("customized-removal", "uninstall", "-g", str(sources[0]), success=False)
    require(
        "user-managed settings" in rejected.stdout + rejected.stderr,
        "Removal failed for another reason",
    )
    require(
        trial.config.read_bytes() == customized
        and (trial.apm_home / "apm.yml").read_bytes() == manifest,
        "Removal changed retained user state",
    )
    _ = trial.config.write_text(original, encoding="utf-8")
    for name, package in zip(PLUGINS, sources, strict=True):
        _ = trial.apm(f"remove-{name}", "uninstall", "-g", str(package))
        require(
            not installed_roots[name].exists(), f"Native cache retained after owned removal: {name}"
        )
    final = tomllib.loads(trial.config.read_text(encoding="utf-8"))
    require(
        final.get("plugins") == {"foreign@external": {"enabled": False}},
        "Removal changed foreign plugins",
    )
    require(final.get("model") == "qualification-sentinel", "Removal changed unrelated settings")
    require(
        read_object(trial.journal)["plugins"] == {}, "Ownership journal retained removed plugins"
    )
    require(
        expected == {name: inventory(path) for name, path in zip(PLUGINS, sources, strict=True)},
        "Source bundle changed",
    )
    return {
        "files": {name: len(files) for name, files in expected.items()},
        "native_transport": "PASS",
        "direct_session_start": "PASS",
        "frozen": "PASS",
        "owned_cleanup": "PASS",
    }


def rejection_trial(trial: Trial, source: Path) -> None:
    package = source / ".agents/plugins/software-engineering"
    trial.declare([package], approved=False)
    result = trial.apm("unapproved", "install", "-g", "--target", "codex", success=False)
    require(
        "allowExecutables" in result.stdout + result.stderr, "Approval refusal was not observed"
    )
    require(
        not trial.journal.exists() and not trial.config.exists(),
        "Unapproved bundle changed native state",
    )
    trial.declare([package], approved=True)
    _ = shutil.copyfile(trial.apm_home / "apm.yml", trial.root / "apm.yml")
    result = trial.apm("project-scope", "install", "--target", "codex", success=False)
    require("user scope" in result.stdout + result.stderr, "Scope refusal was not observed")
    require(
        not trial.journal.exists() and not trial.config.exists(),
        "Project install changed native state",
    )


def loose_copilot_trial(trial: Trial, source: Path) -> None:
    package = source / ".github/plugin/software-engineering"
    trial.declare([package], approved=True)
    _ = trial.apm("install", "install", "-g", "--target", "copilot")
    path = Path(trial.environment["HOME"]) / ".copilot/hooks/software-engineering-hooks.json"
    entry = one_item(object_at(read_object(path)["hooks"])["sessionStart"])
    command = object_at(entry)["bash"]
    require(
        isinstance(command, str) and "$PLUGIN_ROOT/" in command,
        "Loose conversion behavior changed; reassess compatibility",
    )
    if not isinstance(command, str):
        message = "Missing loose command"
        raise QualificationError(message)
    event = json.dumps(
        {"hook_event_name": "SessionStart", "session_id": "loose-control", "source": "startup"}
    )
    result = trial.run("unresolved-hook", ["/bin/sh", "-c", command], stdin=event)
    require(
        result.returncode != 0 and "/hooks/inject-instruction-context.py" in result.stderr,
        "Expected unresolved loose hook failure was not observed",
    )
    require(
        not list((path.parent / "scripts").rglob("inject-instruction-context.py")),
        "Loose conversion unexpectedly supplied the script",
    )
    _ = trial.apm("remove", "uninstall", "-g", str(package))
    require(not path.exists(), "Owned loose hook retained after removal")


def self_test() -> None:
    context_response(
        json.dumps(
            {"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "policy"}}
        ),
        "policy",
    )
    failure_response(
        json.dumps({"continue": False, "stopReason": "INVALID_PLUGIN_ROOT"}), "INVALID_PLUGIN_ROOT"
    )
    with tempfile.TemporaryDirectory(prefix="apm-oracle-") as temporary:
        root = Path(temporary)
        path = root / "script.py.lock"
        _ = path.write_bytes(b"locked")
        require("script.py.lock" in inventory(root), "Inventory omitted the lock")


def qualify(
    source: Path,
    output: Path,
    programs: Programs,
    *,
    compatibility: Path = DEFAULT_COMPATIBILITY,
    candidate: bool = False,
) -> dict[str, object]:
    require(
        platform.system() == "Darwin" and platform.machine() == "arm64",
        "This qualification requires macOS arm64",
    )
    require(not output.exists() and not output.is_symlink(), "Output must be a fresh path")
    require(
        not output.resolve().is_relative_to(source.resolve())
        and not source.resolve().is_relative_to(output.resolve()),
        "Evidence must stay outside the source tree",
    )
    for path in (programs.apm, programs.codex, programs.uv, programs.python):
        require(path.is_file() and os.access(path, os.X_OK), f"Missing executable: {path}")
    record, digest = compatibility_at(compatibility)
    output = output.resolve()
    output.mkdir()
    trial = Trial.create(output / "native", programs)
    observations: dict[str, str] = {}
    report: dict[str, object] = {
        "status": "REJECTED",
        "mode": "candidate" if candidate else "pinned",
        "platform": "macOS arm64",
        "scope": "disposable user home",
        "compatibilitySha256": digest,
        "qualifiedPins": record.qualified.data(),
        "qualifierSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "observedVersions": observations,
        "automatic_hook_delivery": "NOT_TESTED",
        "model_behavior": "NOT_TESTED",
        "remote_acquisition": "NOT_TESTED",
        "evidence": str(output),
        "executable_sha256": {
            name: hashlib.sha256(path.read_bytes()).hexdigest()
            for name, path in (
                ("apm", programs.apm),
                ("codex", programs.codex),
                ("uv", programs.uv),
                ("python", programs.python),
            )
        },
    }
    try:
        for name, executable in (
            ("apm", programs.apm),
            ("codex", programs.codex),
            ("uv", programs.uv),
            ("python", programs.python),
        ):
            result = trial.run(f"version-{name}", [str(executable), "--version"])
            require(result.returncode == 0, f"Cannot inspect {name} version")
            observations[name] = observed_version(name, result.stdout)
        if not candidate:
            require(
                all(
                    observations[name] == version
                    for name, version in record.qualified.data().items()
                ),
                "Unqualified versions; use --candidate to collect isolated evidence",
            )
        result = native_trial(trial, source, observations["codex"])
        if isinstance(result, UpstreamRefusal):
            report.update(
                status="UPSTREAM_REFUSED",
                upstreamRefusal={
                    "requiredCodex": result.required_codex,
                    "observedCodex": observations["codex"],
                },
                native_transport="UPSTREAM_REFUSED",
            )
        else:
            report.update(result)
            rejection_trial(Trial.create(output / "rejections", programs), source)
            report["approval_and_scope_refusal"] = "PASS"
            loose_copilot_trial(Trial.create(output / "loose-copilot", programs), source)
            report.update(
                status="CANDIDATE_QUALIFIED_MECHANISMS" if candidate else "QUALIFIED_MECHANISMS",
                loose_copilot="UNSUPPORTED_REPRODUCED",
            )
    except (QualificationError, OSError, ValueError, subprocess.SubprocessError) as error:
        report.update(status="REJECTED", reason=str(error))
    write_new_json(output / "report.json", report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    _ = modes.add_argument(
        "--self-test", action="store_true", help="Check the portable oracle without external tools"
    )
    _ = modes.add_argument("--show-compatibility", action="store_true")
    _ = modes.add_argument(
        "--check-updates",
        action="store_true",
        help="Read official stable release metadata; preserve qualified pins",
    )
    _ = modes.add_argument(
        "--propose-pins",
        type=Path,
        help="Propose pins from a passing candidate report; never edit the source record",
    )
    _ = modes.add_argument(
        "--candidate",
        action="store_true",
        help="Observe unpinned executables; upstream admission remains authoritative",
    )
    _ = parser.add_argument("--compatibility", type=Path, default=DEFAULT_COMPATIBILITY)
    _ = parser.add_argument("--source", type=Path)
    _ = parser.add_argument(
        "--out", type=Path, help="Fresh run directory, or fresh JSON file for maintenance modes"
    )
    for name in (*ROLES, "python"):
        _ = parser.add_argument(f"--{name}", type=Path)
    args = parser.parse_args()
    try:
        if args.self_test:
            self_test()
            report: dict[str, object] = {"status": "SELF_TEST_PASS"}
        elif args.show_compatibility or args.check_updates or args.propose_pins:
            record, digest = compatibility_at(args.compatibility)
            if args.check_updates:
                record = refresh_latest(record)
            elif args.propose_pins:
                require(args.out is not None, "Pin proposals require a fresh --out JSON file")
                record = propose_pins(record, digest, read_object(args.propose_pins))
            report = record.data()
            if args.out is not None:
                write_new_json(args.out, report)
        else:
            if any(getattr(args, name) is None for name in ("source", "out", *ROLES, "python")):
                parser.error(
                    "--source, --out, --apm, --codex, --uv, and --python are required for qualification"
                )
            programs = Programs(*(getattr(args, name).resolve() for name in (*ROLES, "python")))
            report = qualify(
                args.source.resolve(),
                args.out.absolute(),
                programs,
                compatibility=args.compatibility,
                candidate=args.candidate,
            )
    except (
        QualificationError,
        OSError,
        ValueError,
        urllib.error.URLError,
        subprocess.SubprocessError,
    ) as error:
        report = {"status": "REJECTED", "reason": str(error)}
    print(json.dumps(report))
    return (
        3 if report.get("status") == "UPSTREAM_REFUSED" else int(report.get("status") == "REJECTED")
    )


if __name__ == "__main__":
    raise SystemExit(main())
