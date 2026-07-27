#!/usr/bin/env python3

import argparse
import re
import sys
import tempfile
from pathlib import Path

TERM = r"[A-Z][A-Z0-9]*(?:[ -][A-Z0-9]+)*"
MARKER = re.compile(rf"§({TERM})§")
ANY_MARKER = re.compile(r"§([^§\n]+)§")
ENTRY = re.compile(
    rf"^\s*[-*]\s+§(?P<term>{TERM})§(?:\s*:\s*(?P<definition>.*))?$"
)
SYNONYMS = re.compile(r"^\s+[-*]\s+Known synonyms:\s*(?P<synonyms>.*)$")


def visible_markdown(text):
    lines = []
    fenced = False
    for line in text.splitlines():
        if re.match(r"^\s*```", line):
            fenced = not fenced
            continue
        if not fenced:
            lines.append(re.sub(r"`[^`\n]*`", " ", line))
    return "\n".join(lines)


def document_paths(paths):
    files = []
    for path in paths:
        files.extend(sorted(path.rglob("*.md")) if path.is_dir() else [path])
    return list(dict.fromkeys(files))


def normalized(value):
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def occurrence(text, phrase):
    return re.search(
        rf"(?<![A-Za-z0-9]){re.escape(phrase)}(?![A-Za-z0-9])",
        text,
        re.IGNORECASE,
    )


def check(glossary, documents):
    errors = []
    glossary_text = visible_markdown(glossary.read_text(encoding="utf-8"))
    entries = {}
    current_term = None

    for line_number, line in enumerate(glossary_text.splitlines(), 1):
        match = ENTRY.match(line)
        if match:
            term = match.group("term")
            definition = (match.group("definition") or "").strip()
            if term in entries:
                errors.append(
                    f"{glossary}:{line_number}: duplicate definition for §{term}§ "
                    f"(first at line {entries[term]['line']})"
                )
                current_term = None
                continue
            entries[term] = {
                "line": line_number,
                "definition": definition,
                "synonyms": None,
            }
            current_term = term
            if not definition:
                errors.append(f"{glossary}:{line_number}: missing definition for §{term}§")
            continue

        synonym_match = SYNONYMS.match(line)
        if synonym_match:
            if current_term is None:
                errors.append(f"{glossary}:{line_number}: orphan known synonyms field")
                continue
            entry = entries[current_term]
            if entry["synonyms"] is not None:
                errors.append(
                    f"{glossary}:{line_number}: duplicate known synonyms for "
                    f"§{current_term}§"
                )
                continue
            value = synonym_match.group("synonyms").strip()
            if not value:
                errors.append(
                    f"{glossary}:{line_number}: missing known synonyms value for "
                    f"§{current_term}§"
                )
                entry["synonyms"] = []
            elif value.casefold() == "none":
                entry["synonyms"] = []
            else:
                parts = [part.strip() for part in value.split(",")]
                if any(not part for part in parts):
                    errors.append(
                        f"{glossary}:{line_number}: empty known synonym for "
                        f"§{current_term}§"
                    )
                entry["synonyms"] = [part for part in parts if part]
            continue

        if line.strip() and not line[:1].isspace():
            current_term = None

    if not entries:
        errors.append(f"{glossary}: no glossary entries found")
    for term, entry in entries.items():
        if entry["synonyms"] is None:
            errors.append(
                f"{glossary}:{entry['line']}: missing known synonyms for §{term}§; "
                "write an explicit list or none"
            )

    for marker in ANY_MARKER.finditer(glossary_text):
        if not MARKER.fullmatch(marker.group(0)):
            errors.append(f"{glossary}: invalid glossary marker {marker.group(0)!r}")
    for term in MARKER.findall(glossary_text):
        if term not in entries:
            errors.append(f"{glossary}: undefined glossary term §{term}§")

    unmarked = MARKER.sub(" ", glossary_text)
    for term in entries:
        if re.search(
            rf"(?<![A-Za-z0-9]){re.escape(term)}(?![A-Za-z0-9])",
            unmarked,
        ):
            errors.append(
                f"{glossary}: bare glossary-internal term {term}; write §{term}§"
            )

    label_owners = {}
    for term in entries:
        label = normalized(term)
        owner = label_owners.get(label)
        if owner and owner != term:
            errors.append(
                f"{glossary}: semantic shadowing between §{owner}§ and §{term}§"
            )
        else:
            label_owners[label] = term

    definitions = {}
    for term, entry in entries.items():
        definition = normalized(entry["definition"])
        if not definition:
            continue
        owner = definitions.get(definition)
        if owner and owner != term:
            errors.append(
                f"{glossary}: semantic shadowing: §{owner}§ and §{term}§ "
                "have identical definitions"
            )
        else:
            definitions[definition] = term

    for term, entry in entries.items():
        seen = set()
        for synonym in entry["synonyms"] or []:
            label = normalized(synonym)
            if not label:
                errors.append(f"{glossary}: empty known synonym for §{term}§")
                continue
            if label == normalized(term):
                errors.append(
                    f"{glossary}: known synonym {synonym!r} repeats §{term}§"
                )
                continue
            if label in seen:
                errors.append(
                    f"{glossary}: duplicate known synonym {synonym!r} for §{term}§"
                )
                continue
            seen.add(label)
            owner = label_owners.get(label)
            if owner and owner != term:
                errors.append(
                    f"{glossary}: semantic shadowing: known synonym {synonym!r} "
                    f"for §{term}§ already names §{owner}§"
                )
            else:
                label_owners[label] = term

    glossary_prose = "\n".join(
        "" if SYNONYMS.match(line) else line
        for line in glossary_text.splitlines()
    )
    glossary_prose = MARKER.sub(" ", glossary_prose)
    for term, entry in entries.items():
        for synonym in entry["synonyms"] or []:
            if occurrence(glossary_prose, synonym):
                errors.append(
                    f"{glossary}: known synonym {synonym!r} appears outside its "
                    f"field; migrate to §{term}§ or clarify the intended meaning"
                )

    for path in document_paths(documents):
        text = visible_markdown(path.read_text(encoding="utf-8"))
        for marker in ANY_MARKER.finditer(text):
            if not MARKER.fullmatch(marker.group(0)):
                errors.append(f"{path}: invalid glossary marker {marker.group(0)!r}")
            else:
                errors.append(
                    f"{path}: marker outside glossary {marker.group(0)}; "
                    f"write {marker.group(1)}"
                )
        for term, entry in entries.items():
            for synonym in entry["synonyms"] or []:
                if occurrence(text, synonym):
                    errors.append(
                        f"{path}: known synonym {synonym!r} maps to §{term}§; "
                        f"migrate to {term} or clarify the intended meaning"
                    )

    return entries, errors


def self_test():
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        glossary = root / "GLOSSARY.md"
        document = root / "guide.md"
        glossary.write_text(
            "- §REQUEST§: A unit of work.\n"
            "  - Known synonyms: work request, job\n",
            encoding="utf-8",
        )
        document.write_text("Send the REQUEST.\n`§REQUEST§` is code.\n", encoding="utf-8")
        assert not check(glossary, [document])[1]
        document.write_text("Send the work request.\n", encoding="utf-8")
        assert any(
            "migrate to REQUEST or clarify" in error
            for error in check(glossary, [document])[1]
        )
        glossary.write_text(
            "- §REQUEST§: A REQUEST unit.\n"
            "  - Known synonyms: work request\n",
            encoding="utf-8",
        )
        assert any(
            "bare glossary-internal term" in error
            for error in check(glossary, [])[1]
        )
        glossary.write_text(
            "- §REQUEST§: A unit of work.\n"
            "  - Known synonyms: work request\n",
            encoding="utf-8",
        )
        document.write_text("Send the §REQUEST§.\n", encoding="utf-8")
        errors = check(glossary, [document])[1]
        assert any("marker outside glossary" in error for error in errors)
        glossary.write_text(
            "- §REQUEST§: A unit related to §MISSING§.\n"
            "  - Known synonyms: work request\n",
            encoding="utf-8",
        )
        assert any("undefined glossary term" in error for error in check(glossary, [])[1])
        glossary.write_text(
            "- §REQUEST§: A unit of work.\n"
            "  - Known synonyms: work request\n"
            "- §REQUEST§: Another meaning.\n"
            "  - Known synonyms: job\n",
            encoding="utf-8",
        )
        assert any("duplicate definition" in error for error in check(glossary, [])[1])
        glossary.write_text(
            "- §REQUEST§: A unit of work.\n",
            encoding="utf-8",
        )
        assert any("missing known synonyms" in error for error in check(glossary, [])[1])
        glossary.write_text(
            "- §REQUEST§\n"
            "  - Known synonyms: work request\n",
            encoding="utf-8",
        )
        assert any("missing definition" in error for error in check(glossary, [])[1])
        glossary.write_text(
            "- §REQUEST§: A unit of work.\n"
            "  - Known synonyms: job\n"
            "- §JOB§: A scheduled task.\n"
            "  - Known synonyms: none\n",
            encoding="utf-8",
        )
        assert any("semantic shadowing" in error for error in check(glossary, [])[1])


def main():
    parser = argparse.ArgumentParser(
        description="Check canonical glossary definitions, synonyms, and prose."
    )
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("glossary", nargs="?", type=Path)
    parser.add_argument("documents", nargs="*", type=Path)
    args = parser.parse_args()

    if args.self_test:
        self_test()
        print("Self-test passed.")
        return 0
    if args.glossary is None:
        parser.error("the following arguments are required: glossary")

    try:
        entries, errors = check(args.glossary, args.documents)
    except (OSError, UnicodeError) as error:
        print(error, file=sys.stderr)
        return 1

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    print(
        f"Glossary OK: {len(entries)} terms across "
        f"{len(document_paths(args.documents))} documents."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
