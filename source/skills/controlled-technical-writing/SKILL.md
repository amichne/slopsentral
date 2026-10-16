---
name: "controlled-technical-writing"
description: "Use for technical prose, local Vale assessment, and commit or Diataxis rules."
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

## Workflow

1. Load the repository's nearby writing rules and source material.
2. Keep the terms that the source uses. Flag ambiguous meaning without inventing a definition.
3. Draft or revise only the requested text.
4. Run the bundled text assessment for every changed prose artifact. Use the
   same engine, rules, and thresholds for README files, reference pages,
   specifications, runbooks, and other technical prose. Do not select a metric
   or mode from the document's purpose.
5. Resolve findings without changing facts, domain meaning, or quoted text.
   Re-run the assessment after edits, then check reader comprehension separately.

## One Measurement Procedure

Read [text assessment](references/text-assessment.md) before measuring text.
From this skill directory, run:

```sh
uv run --locked --script scripts/assess_text.py --vale-bin /path/to/vale /path/to/document.md
```

The procedure uses Vale 3.24.0 and examines the integrity of the bundled rules.
It reports a Flesch-Kincaid grade estimate, sentence length, diction, contractions, modal verbs, and excessive claims.
It needs only the prose files and the pinned engine.
Keep the JSON report and its input hashes.
Exit 0 means no automated findings, exit 1 means findings remain, and exit 2 means assessment failed.
Missing dependencies, invalid input, and policy overrides produce typed failures.

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
- Keep code tokens, standard acronyms, and quoted text exact.
- Flag ambiguous domain meaning for review.
- The output contains no preamble or closing text that the user did not request.

## Completion Criteria

The requested prose preserves the source meaning and has a recorded assessment.
Resolve each finding or record its exact rule, location, and technical reason to keep the text.
Never disable the rule or report a clean run when findings remain.
An unavailable assessment remains explicit.
Reader testing must separately establish that the intended action is clear;
a numeric estimate never establishes comprehension.

## Provenance

This is a local rewrite informed by the controlled-language approach in
[The cure for AI slop](https://github.com/woosal1337/blog/tree/main/videos/ep01-the-cure-for-ai-slop).
It does not claim certification against ASD-STE100.
