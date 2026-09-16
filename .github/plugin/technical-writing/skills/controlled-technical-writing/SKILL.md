---
name: "controlled-technical-writing"
description: "Use when writing or revising technical prose that needs plain wording, stable terms, disambiguated glossary lookup, one name per concept, or known-synonym migration."
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

## Workflow

1. Choose the mode.
   Use `strict` for procedures, safety text, and error messages. Use `plain` for
   general technical prose.
2. Load the repository's nearby writing rules and source material.
3. If a repository glossary governs a term or prose contains an ambiguous
   `ALL CAPS` domain phrase, consult the glossary and load [glossary-contract.md](references/glossary-contract.md)
   before drafting.
4. Resolve known synonyms against the glossary. Migrate clear matches to the
   canonical term. Preserve and flag an ambiguous term rather than inventing a
   definition or blocking unrelated edits.
5. Draft or revise only the requested text.
6. Check every changed sentence and glossary reference before returning it.

## Writing Rules

- Use one name for one concept.
- Use common, concrete words.
- Use active voice when the actor is known.
- Use a verb for an action instead of a noun phrase.
- Put one instruction in each sentence.
- Put conditions before the action they control.
- Keep one topic in each paragraph.
- Remove filler, marketing claims, and unsupported adjectives.
- In `strict` mode, keep instructions at 20 words or fewer and descriptive
  sentences at 25 words or fewer.
- In `plain` mode, prefer short sentences but preserve necessary precision and
  natural technical vocabulary.

## Final Check

- Each concept has one name.
- Each sentence states one clear action or fact.
- Every claim is supported by the source material.
- Ambiguous domain terms follow the repository glossary when one exists;
  code tokens, standard acronyms, and quoted text are not renamed by guesswork.
- Every known synonym was migrated or returned for clarification.
- No glossary registration shadows an existing term, synonym, or definition.
- Glossary markers occur only inside the glossary.
- The output contains no preamble or closing text that the user did not request.

## Completion Criteria

The requested prose is complete when it preserves the source meaning, follows
the selected mode, and passes the repository's glossary check when a glossary
is present.

## Provenance

This is a local rewrite informed by the controlled-language approach in
[The cure for AI slop](https://github.com/woosal1337/blog/tree/main/videos/ep01-the-cure-for-ai-slop).
It does not claim certification against ASD-STE100.
