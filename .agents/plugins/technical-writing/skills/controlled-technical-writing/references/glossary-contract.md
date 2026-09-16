# Glossary Contract

Load this contract when a repository defines controlled terms or prose contains
an `ALL CAPS` word or phrase.

## Lookup

Written documentation uses bare `ALL CAPS` terms. Each such term is a lookup
signal:

1. Search from the document's directory toward the repository root for
   `GLOSSARY.md` or `glossary.md`.
2. If neither file exists, search Markdown headings for a repository glossary.
3. Search the glossary for the exact marked term.
4. If the term exists, use its definition as the sole meaning in the
   repository.
5. If it does not exist, do not invent a definition. Treat it as an ordinary
   acronym unless the task requires a new glossary entry.

An `ALL CAPS` candidate is not automatically a glossary term.

```markdown
The SOURCE OF TRUTH owns generated copies.
```

## Internal Marker

Use `§TERM§` only inside the glossary. The marker grammar is:

```text
§[A-Z][A-Z0-9]*(?:[ -][A-Z0-9]+)*§
```

Examples:

- `§REQUEST§`
- `§SOURCE OF TRUTH§`
- `§HTTP-2§`

The section sign is not CommonMark syntax. Vertical pipes are not suitable
because Markdown uses them for tables.

## Entry

Each entry requires one non-empty definition and one known-synonyms field:

```markdown
- §SOURCE OF TRUTH§: The only authored location from which generated copies derive.
  - Known synonyms: canonical source, authoritative source
```

Write `Known synonyms: none` when no synonyms are known. Synonyms are
comma-separated lookup and migration inputs. They are not permitted alternate
names.

The glossary definition is the sole meaning of that term in the repository:

- Do not redefine a marked term in another file or local section.
- If one phrase needs two meanings, give the meanings different terms.
- Use the bare uppercase term in written documentation.
- Preserve the exact uppercase spelling in prose and inside every marker.
- Mark references inside other glossary definitions.
- Keep known synonyms only in their entry's `Known synonyms` field.
- Do not put glossary markers in documentation outside the glossary.
- Do not mark code identifiers, command syntax, or literal values inside code
  spans or fenced code blocks.

## Synonym Kickback

When prose uses a known synonym:

1. Compare its use with the canonical definition.
2. If the meanings match, replace it with the bare canonical `ALL CAPS` term.
3. If the meanings differ or remain uncertain, return the conflict to the user
   or calling LLM for clarification.
4. Do not register a new term to bypass the conflict.

## Registration

Before adding an entry, compare its proposed term, synonyms, and definition
with every existing entry:

- Reject a term or synonym that normalizes to an existing term or synonym.
- Reject an identical definition under a different term.
- Have the LLM compare non-identical definitions for semantic overlap.
- If an existing definition covers the proposal, migrate to that canonical
  term.
- If the boundary is unclear, request clarification before editing the
  glossary.
- Register the entry only when it represents a distinct semantic reference.

Different spelling does not create a different meaning. Glossary registration
must preserve disambiguation and cannot create semantic shadowing.

## Check

Run the bundled checker from the skill directory:

```sh
python3 scripts/check_glossary.py /path/to/GLOSSARY.md /path/to/docs
```

The check fails for missing definitions or synonym fields, invalid internal
markers, duplicate entries or synonyms, lexical shadowing, identical
definitions, undefined internal references, bare glossary-internal references,
known synonyms in prose, and markers outside the glossary.
