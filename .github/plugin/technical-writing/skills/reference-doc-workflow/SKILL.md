---
name: "reference-doc-workflow"
description: "Shape a substantial proposal, technical specification, RFC, or decision document when audience, structure, or reader comprehension needs development. Use technical-documentation for a defined repository document and controlled-technical-writing for prose-only edits."
---

# Reference Doc Workflow

Use this skill to help a user produce documentation that works for its readers,
including future agents that may rely on the document as reference material.
Keep the workflow collaborative: gather context, shape the document, draft in
small sections, then test whether a fresh reader can use it.

## Operating Contract

- Treat the intended reader, decision, and reuse context as first-class inputs.
- Keep the document grounded in source material, code, command output, or user
  decisions rather than invented filler.
- Separate durable reference content from transient drafting notes.
- Prefer precise headings, short sections, examples, and explicit verification
  paths over long narrative.
- Edit the document in place when working in a repository.
- Use the repository's existing documentation conventions before introducing a
  new structure.

## Workflow

1. Establish the document contract.
   Ask only for missing details that change the document shape:
   - document type
   - primary audience
   - desired reader action or decision
   - source material and templates
   - publication location or file path
   - constraints, risks, or review gates

2. Gather context.
   Let the user info-dump, point to files, or provide links. Read the local
   materials that are in scope. Track what is known, what is assumed, and what
   still needs confirmation.

3. Choose the structure.
   Reuse an existing template when present. Otherwise propose the smallest
   section set that can carry the reader's job. Put summaries and introductions
   last when the core decision or technical approach is still moving.

4. Draft the authorized document.
   Use the supplied context and agreed structure to write a reviewable draft.
   Ask a targeted question only when a missing fact changes the reader's
   decision. Use a section-by-section collaboration loop when the user requests
   it; do not require approval for each paragraph or section.

5. Tighten the document.
   Re-read the full draft for flow, contradictions, duplicated claims, missing
   evidence, undefined terms, and generic filler. Remove text that does not help
   the intended reader act.

6. Reader-test before calling it done.
   Test the document against likely reader questions. Use a fresh subagent when
   available; otherwise simulate a cold reader from the document alone. Fix any
   ambiguity, missing context, or false assumption found by the test.

## Reference-Source Shape

When the document will be used by agents as reference material, organize it so
the agent can load only what is needed:

- Put trigger conditions and workflow routing near the top.
- Keep canonical rules in the main document; move examples, variants, and long
  background into clearly named reference files.
- Use stable headings and repository-relative links.
- State source-of-truth ownership and validation commands explicitly.
- Distinguish hard requirements from heuristics.
- Prefer concrete examples over abstract explanation.
- Do not duplicate large policy blocks across files; link to the owning source.

For deeper checks, load [reader-testing.md](references/reader-testing.md).

## Completion Criteria

Do not call the document done until:

- the document's audience and purpose are clear;
- every important claim has support, a source, or an explicit assumption;
- instructions are actionable without conversation context;
- related reference files are linked from the main document;
- reader testing has no unresolved ambiguity that would change behavior;
- any validation commands, review gates, or publication steps have been run or
  explicitly left as residual work.
