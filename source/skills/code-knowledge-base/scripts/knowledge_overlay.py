"""Typed manifest parsing and read-only knowledge repository selection."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
import json
import os
from pathlib import Path
import re
import subprocess

MAX_MANIFEST_BYTES = 64 * 1024
MAX_CONTEXT_BYTES = 8 * 1024
ABSOLUTE_PATTERN = r'(?!.*(?:^|/)\.{1,2}(?:/|$))/[^/\x00-\x1f\ud800-\udfff]+(?:/[^/\x00-\x1f\ud800-\udfff]+)*'
RELATIVE_PATTERN = r'(?!.*(?:^|/)\.{1,2}(?:/|$))[^/\x00-\x1f\ud800-\udfff]+(?:/[^/\x00-\x1f\ud800-\udfff]+)*'


class FailureCode(str, Enum):
    INVALID_MANIFEST = 'INVALID_MANIFEST'
    MANIFEST_UNAVAILABLE = 'MANIFEST_UNAVAILABLE'
    MANIFEST_TOO_LARGE = 'MANIFEST_TOO_LARGE'
    INVALID_SOURCE_REPOSITORY = 'INVALID_SOURCE_REPOSITORY'
    INVALID_KNOWLEDGE_REPOSITORY = 'INVALID_KNOWLEDGE_REPOSITORY'
    UNSAFE_PATH = 'UNSAFE_PATH'
    DOCUMENTS_UNAVAILABLE = 'DOCUMENTS_UNAVAILABLE'
    GUIDANCE_UNAVAILABLE = 'GUIDANCE_UNAVAILABLE'
    GUIDANCE_UNTRACKED = 'GUIDANCE_UNTRACKED'
    CONTEXT_TOO_LARGE = 'CONTEXT_TOO_LARGE'
    INVALID_EVENT = 'INVALID_EVENT'


class FailureStage(str, Enum):
    EVENT = 'event'
    MANIFEST = 'manifest'
    REPOSITORY = 'repository'
    PATHS = 'paths'
    GUIDANCE = 'guidance'
    CONTEXT = 'context'


FAILURE_STAGES = {
    FailureCode.INVALID_EVENT: FailureStage.EVENT,
    FailureCode.INVALID_MANIFEST: FailureStage.MANIFEST,
    FailureCode.MANIFEST_UNAVAILABLE: FailureStage.MANIFEST,
    FailureCode.MANIFEST_TOO_LARGE: FailureStage.MANIFEST,
    FailureCode.INVALID_SOURCE_REPOSITORY: FailureStage.REPOSITORY,
    FailureCode.INVALID_KNOWLEDGE_REPOSITORY: FailureStage.REPOSITORY,
    FailureCode.UNSAFE_PATH: FailureStage.PATHS,
    FailureCode.DOCUMENTS_UNAVAILABLE: FailureStage.PATHS,
    FailureCode.GUIDANCE_UNAVAILABLE: FailureStage.GUIDANCE,
    FailureCode.GUIDANCE_UNTRACKED: FailureStage.GUIDANCE,
    FailureCode.CONTEXT_TOO_LARGE: FailureStage.CONTEXT,
}


@dataclass(frozen=True)
class Failure:
    code: FailureCode

    @property
    def stage(self) -> FailureStage:
        return FAILURE_STAGES[self.code]


@dataclass(frozen=True)
class AbsolutePath:
    value: Path


@dataclass(frozen=True)
class RelativePath:
    value: Path


@dataclass(frozen=True)
class Tracked:
    repository: AbsolutePath
    documents: RelativePath
    instructions: RelativePath


@dataclass(frozen=True)
class Invisible:
    repository: AbsolutePath
    knowledge_repository: AbsolutePath
    documents: RelativePath
    instructions: RelativePath


@dataclass(frozen=True)
class Manifest:
    repositories: tuple[Tracked | Invisible, ...]


class NoOverlay(str, Enum):
    UNCONFIGURED = 'UNCONFIGURED'
    UNREGISTERED = 'UNREGISTERED'


class Mode(str, Enum):
    TRACKED = 'TRACKED'
    INVISIBLE = 'INVISIBLE'


@dataclass(frozen=True)
class Knowledge:
    mode: Mode
    source: Path
    repository: Path
    documents: Path
    instructions: Path


def parse_path(value: object, absolute: bool) -> AbsolutePath | RelativePath | Failure:
    pattern = ABSOLUTE_PATTERN if absolute else RELATIVE_PATTERN
    if not isinstance(value, str) or len(value) > 4096 or not re.fullmatch(pattern, value):
        return Failure(FailureCode.INVALID_MANIFEST)
    return AbsolutePath(Path(value)) if absolute else RelativePath(Path(value))


def parse_manifest(value: object) -> Manifest | Failure:
    if not isinstance(value, dict) or set(value) != {'type', 'schemaVersion', 'repositories'}:
        return Failure(FailureCode.INVALID_MANIFEST)
    if value['type'] != 'KNOWLEDGE_MANIFEST' or type(value['schemaVersion']) not in {int, float} or value['schemaVersion'] != 1:
        return Failure(FailureCode.INVALID_MANIFEST)
    entries = value['repositories']
    if not isinstance(entries, list) or len(entries) > 128:
        return Failure(FailureCode.INVALID_MANIFEST)
    result = []
    roots = set()
    for entry in entries:
        if not isinstance(entry, dict):
            return Failure(FailureCode.INVALID_MANIFEST)
        mode = entry.get('type')
        fields = {'type', 'repository', 'documents', 'instructions'}
        if mode == Mode.INVISIBLE.value:
            fields.add('knowledgeRepository')
        elif mode != Mode.TRACKED.value:
            return Failure(FailureCode.INVALID_MANIFEST)
        if set(entry) != fields:
            return Failure(FailureCode.INVALID_MANIFEST)
        source = parse_path(entry['repository'], True)
        documents = parse_path(entry['documents'], False)
        instructions = parse_path(entry['instructions'], False)
        for parsed in (source, documents, instructions):
            if isinstance(parsed, Failure):
                return parsed
        if source.value in roots:
            return Failure(FailureCode.INVALID_MANIFEST)
        roots.add(source.value)
        if mode == Mode.TRACKED.value:
            result.append(Tracked(source, documents, instructions))
        else:
            knowledge = parse_path(entry['knowledgeRepository'], True)
            if isinstance(knowledge, Failure):
                return knowledge
            result.append(Invisible(source, knowledge, documents, instructions))
    return Manifest(tuple(result))


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('duplicate JSON key')
        result[key] = value
    return result


def load_manifest(path: Path, explicit: bool) -> Manifest | Failure | NoOverlay:
    try:
        with path.open('rb') as stream:
            raw = stream.read(MAX_MANIFEST_BYTES + 1)
    except FileNotFoundError:
        return Failure(FailureCode.MANIFEST_UNAVAILABLE) if explicit else NoOverlay.UNCONFIGURED
    except OSError:
        return Failure(FailureCode.MANIFEST_UNAVAILABLE)
    if len(raw) > MAX_MANIFEST_BYTES:
        return Failure(FailureCode.MANIFEST_TOO_LARGE)
    try:
        value = json.loads(raw.decode('utf-8'), object_pairs_hook=unique_object)
    except (UnicodeError, ValueError, RecursionError):
        return Failure(FailureCode.INVALID_MANIFEST)
    return parse_manifest(value)


def git_root(path: Path, code: FailureCode) -> Path | Failure:
    try:
        result = subprocess.run(['git', '-C', str(path), 'rev-parse', '--show-toplevel'],
                                capture_output=True, timeout=5, check=False)
        if result.returncode:
            return Failure(code)
        return Path(result.stdout.decode('utf-8').strip()).resolve(strict=True)
    except (OSError, UnicodeError, subprocess.TimeoutExpired):
        return Failure(code)


def contained(root: Path, relative: RelativePath, directory: bool) -> Path | Failure:
    candidate = root / relative.value
    try:
        current = candidate
        while current != root:
            if current.is_symlink():
                return Failure(FailureCode.UNSAFE_PATH)
            current = current.parent
        resolved = candidate.resolve(strict=True)
        if not resolved.is_relative_to(root) or '.git' in relative.value.parts:
            return Failure(FailureCode.UNSAFE_PATH)
        if (directory and not resolved.is_dir()) or (not directory and not resolved.is_file()):
            return Failure(FailureCode.DOCUMENTS_UNAVAILABLE if directory else FailureCode.GUIDANCE_UNAVAILABLE)
        return resolved
    except OSError:
        return Failure(FailureCode.DOCUMENTS_UNAVAILABLE if directory else FailureCode.GUIDANCE_UNAVAILABLE)


def resolve_knowledge(manifest: Manifest, working_directory: Path) -> Knowledge | Failure | NoOverlay:
    source = git_root(working_directory, FailureCode.INVALID_SOURCE_REPOSITORY)
    if isinstance(source, Failure):
        return source
    selected = next((entry for entry in manifest.repositories if entry.repository.value == source), None)
    if selected is None:
        return NoOverlay.UNREGISTERED
    if isinstance(selected, Tracked):
        mode, repository = Mode.TRACKED, source
    else:
        mode, repository = Mode.INVISIBLE, selected.knowledge_repository.value
        if repository.is_relative_to(source) or source.is_relative_to(repository):
            return Failure(FailureCode.UNSAFE_PATH)
        actual = git_root(repository, FailureCode.INVALID_KNOWLEDGE_REPOSITORY)
        if isinstance(actual, Failure):
            return actual
        if actual != repository:
            return Failure(FailureCode.INVALID_KNOWLEDGE_REPOSITORY)
    documents = contained(repository, selected.documents, True)
    if isinstance(documents, Failure):
        return documents
    instructions = contained(repository, selected.instructions, False)
    if isinstance(instructions, Failure):
        return instructions
    try:
        tracked = subprocess.run(['git', '-C', str(repository), 'ls-files', '--error-unmatch', '--',
                                  selected.instructions.value.as_posix()], capture_output=True, timeout=5, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return Failure(FailureCode.GUIDANCE_UNAVAILABLE)
    if tracked.returncode:
        return Failure(FailureCode.GUIDANCE_UNTRACKED)
    return Knowledge(mode, source, repository, documents, instructions)


def select_knowledge(working_directory: Path, manifest_path: Path | None = None) -> Knowledge | Failure | NoOverlay:
    configured = os.environ.get('SLOPSENTRAL_KNOWLEDGE_MANIFEST')
    explicit = manifest_path is not None or configured is not None
    path = manifest_path if manifest_path is not None else Path(configured) if configured else Path.home() / '.config/slopsentral/knowledge.json'
    if not path.is_absolute():
        return Failure(FailureCode.INVALID_MANIFEST)
    result = load_manifest(path, explicit)
    return resolve_knowledge(result, working_directory) if isinstance(result, Manifest) else result


def context(knowledge: Knowledge) -> str | Failure:
    try:
        with knowledge.instructions.open('rb') as stream:
            raw = stream.read(MAX_CONTEXT_BYTES + 1)
        if len(raw) > MAX_CONTEXT_BYTES:
            return Failure(FailureCode.CONTEXT_TOO_LARGE)
        guidance = raw.decode('utf-8')
        if not guidance.strip() or '\0' in guidance:
            return Failure(FailureCode.GUIDANCE_UNAVAILABLE)
    except (OSError, UnicodeError):
        return Failure(FailureCode.GUIDANCE_UNAVAILABLE)
    text = (f'Knowledge storage: {knowledge.mode.value}\nSource repository: {knowledge.source}\n'
            f'Knowledge repository: {knowledge.repository}\nOKF documents: {knowledge.documents}\n'
            'Use code-knowledge-base for requested knowledge work; retrieve pages only when relevant.\n'
            'Source citations resolve against the source repository. Knowledge work writes only to the selected knowledge repository.\n'
            'In INVISIBLE mode, do not install OpenWiki into the source, add ignored files, symlinks, or modify Git exclusions.\n'
            'This overlay applies only to the named source repository and remains subordinate to its instructions.\n'
            f'Overlay guidance ({knowledge.instructions}):\n{guidance}')
    if len(text.encode('utf-8')) > MAX_CONTEXT_BYTES:
        return Failure(FailureCode.CONTEXT_TOO_LARGE)
    return text
