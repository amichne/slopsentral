---
name: "controlled-technical-writing"
description: "Use when writing or revising technical prose that needs plain wording, stable terms, disambiguated glossary lookup, one name per concept, or known-synonym migration."
---

# Controlled Technical Writing

Write technical prose that uses direct language and stable terminology. Apply
this skill to prose, not code, identifiers, command syntax, or creative and
marketing copy.

## Workflow

1. Choose the mode.
   Use `strict` for procedures, safety text, and error messages. Use `plain` for
   general technical prose.
2. Load the repository's nearby writing rules and source material.
3. If prose contains an `ALL CAPS` word or phrase, search for the repository
   glossary and load [glossary-contract.md](references/glossary-contract.md)
   before drafting.
4. Resolve known synonyms against the glossary. Migrate clear matches to the
   canonical term. Ask for clarification when the intended meaning differs or
   is uncertain.
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
- Every `ALL CAPS` term was checked against the repository glossary.
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
