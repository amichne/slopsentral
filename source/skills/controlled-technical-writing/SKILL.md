---
name: "controlled-technical-writing"
description: "Use when writing or revising technical prose, measuring text complexity and readability with the shared Vale policy, or creating glossaries and local Vale defaults for commits and Diataxis."
---

# Controlled Technical Writing

Write technical prose that uses direct language and stable terminology. Apply
this skill to prose, not code, identifiers, command syntax, or creative and
marketing copy.

## Evidence and Voice

For text the user will publish or send, establish audience, purpose, supplied
facts, and the user's actual position. Never invent a first-person experience,
result, preference, or commitment. Retrieve public facts only when research is
part of the task. Complete supported passages and mark material gaps; ask only
for missing personal information that changes the text.

Preserve the requested shape, including a one-sentence review comment. Leave an
already accurate, clear passage unchanged. Quoted text and attributed prose keep
their original voice. Read [grounding](references/grounding.md) for evidence and
no-change checks, and [provenance](references/provenance.md) for source lineage.

## Local Tool Policy

Use only the standalone Vale CLI and the bundled local rules.
Do not connect to Vale CMS or Vale MCP servers.
Do not register a server, create an account, or send project prose to a hosted service.
Read [local Vale](references/vale-local.md) for the installer, configuration, and offline archive input.
Read [glossary authoring](references/glossary-authoring.md) before you choose a domain term.
Use the [JSON Schema](references/glossary.schema.json) and [entry example](assets/glossary-entry.json) for a new glossary.

## Workflow

1. Load the repository's nearby writing rules and source material.
2. If a repository glossary governs a term or prose contains an ambiguous
   domain phrase, consult the glossary and load [glossary-contract.md](references/glossary-contract.md)
   before drafting.
3. Resolve known synonyms against the glossary. Migrate clear matches to the
   canonical term. Preserve and flag an ambiguous term rather than inventing a
   definition or blocking unrelated edits.
4. Draft or revise only the requested text.
5. Run the bundled text assessment for every changed prose artifact. Use the
   same engine, rules, and thresholds for README files, reference pages,
   specifications, runbooks, and other technical prose. Do not select a metric
   or mode from the document's purpose.
6. Resolve findings without changing facts, domain meaning, or quoted text.
   Re-run the assessment after edits, then check reader comprehension separately.

## One Measurement Procedure

Read [text assessment](references/text-assessment.md) before measuring text.
From this skill directory, run:

```sh
uv run --locked --script scripts/assess_text.py --glossary /path/to/glossary.json /path/to/document.md
```

The procedure uses Vale 3.24.0 with bundled rules whose integrity is checked.
It reports a Flesch-Kincaid grade estimate, a sentence-length advisory, a fixed diction policy, and the repository's canonical glossary.
Preserve the JSON report and
its input hashes. Missing dependencies, invalid input, and policy overrides
are typed failures, not permission to substitute another formula.

If no glossary exists, omit `--glossary`. The report retains the measurements
but is `INCOMPLETE`; terminology consistency has not been checked. Do not
invent glossary definitions to get a successful check.

## Writing Rules

- Use one name for one concept.
- Use names that current domain sources use for the same concept.
- Do not infer synonymy from related roles or similar wording.
- Use common, concrete words.
- Use active voice when the actor is known.
- Use a verb for an action instead of a noun phrase.
- Put one instruction in each sentence.
- Put conditions before the action they control.
- Keep one topic in each paragraph.
- Remove filler, marketing claims, and unsupported adjectives.
- Review sentences above 25 words and estimated grades above 8. These shared
  advisories are revision signals, not proof that the reader understands the text.
- Preserve necessary precision and natural technical vocabulary.

## Final Check

- Each concept has one name.
- Each sentence states one clear action or fact.
- Every claim is supported by the source material.
- Ambiguous domain terms follow the repository glossary when one exists;
  code tokens, standard acronyms, and quoted text are not renamed by guesswork.
- Every known synonym was migrated or returned for clarification.
- No glossary registration shadows an existing term, synonym, or definition.
- Structured glossaries use the JSON source and its generated reader view.
- Existing Markdown glossaries keep their declared casing and marker grammar.
- The output contains no preamble or closing text that the user did not request.

## Completion Criteria

The requested prose preserves the source meaning and has a recorded assessment.
Resolve each finding or record its exact rule, location, and technical reason to keep the text.
Never disable the rule or report a clean run when findings remain.
An unavailable assessment or missing glossary remains explicit.
Reader testing must separately establish that the intended action is clear;
a numeric estimate never establishes comprehension.

## Provenance

This is a local rewrite informed by the controlled-language approach in
[The cure for AI slop](https://github.com/woosal1337/blog/tree/main/videos/ep01-the-cure-for-ai-slop).
It does not claim certification against ASD-STE100.
