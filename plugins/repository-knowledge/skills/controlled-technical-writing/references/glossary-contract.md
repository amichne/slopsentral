# Glossary Contract

## Canonical Source

Use `glossary.json` as the source for a new glossary.
The [JSON Schema](glossary.schema.json) declares its record shape.
The [entry example](../assets/glossary-entry.json) supplies an established concept without invented replacement targets.
A generated `GLOSSARY.md` gives readers the same definitions.
Edit the JSON source, then regenerate that view.

Each concept has a stable identifier and a separate display term.
The display term keeps its established domain spelling.
The contract does not force uppercase or section-sign markers on ordinary domain words.
Keep code identifiers, commands, UI labels, quotations, and public names exact.

Each entry records:

- The established term, standalone definition, and local scope.
- A concrete example and the nearest distinct concept.
- External usage with a URL, source location, examination date, and supported meaning.
- Local source paths and their locations.
- A plain-text justification for the name.
- References to related concept identifiers.
- Explicit rejected forms, including an empty list when no target passes review.

The first glossary remains provisional because independent reader review is absent.
A provisional glossary does not authorize a repository-wide rename.

## Rejected Forms

`REPLACE` records a form that is incorrect throughout the declared document scope.
Its evidence must establish the intended referent and the canonical replacement.
A misspelling needs spelling evidence.
A deprecated name needs version and scope evidence.
An incorrect synonym needs evidence of the same concept in the same scope.

`REVIEW` records a form whose meaning needs context.
The generated Vale rule reports it without a replacement action.
Do not move a review target into the replacement set merely to remove a finding.
Related concepts belong in `related` or `distinction`, not in the replacement set.

Every rejected form needs a reason and evidence.
Evidence can cite external usage or record a plain-text justification.
A justification records the author's claim and does not prove external agreement.
An empty `rejectedForms` list means that no alternate label passed this review.
It does not claim that the wider domain has no alternate labels.

The parser rejects duplicate identifiers, conflicting labels, identical definitions, and unknown or self-referential related concepts.
A rejected form cannot equal another concept's canonical term.
That restriction also prevents replacement chains through registered canonical terms.
The parser does not decide semantic equivalence from textual similarity.

## Document Scope

`scope.root` is a POSIX path relative to the JSON file's directory.
`scope.include` and `scope.exclude` contain literal document globs.
`*` matches within one path segment, `**` crosses segments, and `?` matches one character.
Exclusions take precedence.
The root can name the repository with `..` when the JSON source resides under `docs/`.
Citation paths remain repository-relative and cannot contain `..`.

The occurrence traversal uses case-insensitive literal matching at word limits.
It chooses the longest label when matches overlap.
List each rejected inflection explicitly.
The tool does not infer a word family.
The traversal preserves line numbers and reports canonical, replacement, and review occurrences.
It excludes common code spans, fenced blocks, frontmatter, link destinations, and comments.
This lexical view does not implement every Markdown or MDX construct.
Use Vale assessment for native markup interpretation.

The assessment reports each document as `IN_SCOPE`, `OUT_OF_SCOPE`, or `NOT_PROVIDED` for terminology.
An out-of-scope document receives the fixed prose measurements without glossary substitutions.
Neither occurrence counts nor an `ASSESSED` result prove reader comprehension or semantic correctness.

## Commands

From the skill directory, examine the contract and requested documents:

```sh
uv run --locked --script scripts/check_glossary.py /path/to/glossary.json /path/to/docs
```

Generate the reader view:

```sh
uv run --locked --script scripts/check_glossary.py /path/to/glossary.json --render /path/to/GLOSSARY.md
```

Reject a stale reader view:

```sh
uv run --locked --script scripts/check_glossary.py /path/to/glossary.json --check-render /path/to/GLOSSARY.md
```

Generate Vale rules in a new directory:

```sh
uv run --locked --script scripts/check_glossary.py /path/to/glossary.json --vale-dir /path/to/new-rules
```

The assessment loads these rules automatically from the same parsed contract:

```sh
uv run --locked --script scripts/assess_text.py --glossary /path/to/glossary.json /path/to/document.md
```

The traversal returns a JSON report with the source digest, entry count, target counts, document scope, and located occurrences.
Exit 0 means that the contract passes and the requested prose contains no recorded incorrect or review form.
Exit 1 means that replacement or review occurrences remain.
Exit 2 means that the input, local files, or generated view failed.
The traversal and assessment never change source prose.

## Existing Markdown Contracts

Repositories that already use marked `GLOSSARY.md` entries keep their current grammar and casing contract.
The same entry point accepts that format without implicit conversion.
Its existing parser supplies the assessment's legacy literal rules.
Do not assess a generated reader view as an independently authored Markdown glossary.
Use the JSON source for a structured glossary.

## Evidence Limits and Local Operation

JSON Schema establishes record shape.
The typed parser establishes lexical ownership, references, and supported scope syntax.
Vale reports configured prose forms.
These mechanisms do not establish current source truth, accepted domain meaning, factual accuracy, or reader comprehension.
Use the [authoring protocol](glossary-authoring.md) for those judgments.

All glossary operations use local files.
The tools treat external URLs as citations and never fetch them.
Do not connect to Vale CMS or Vale MCP servers.
Do not upload project prose or register a server.
A separate research task can examine public domain sources.
