---
name: technical-documentation
description: "Use when creating or updating a repository README, how-to, architecture decision, runbook, onboarding guide, or source-backed diagram; not for prose-only edits or site navigation."
---

# Technical Documentation

Create the document that lets its reader complete one concrete task. This skill
owns document purpose and source coverage. Prose revision belongs to
controlled-technical-writing, site configuration to site-docs-authoring, and
signature-backed knowledge bundles to code-knowledge-base.

## Workflow

1. Identify the reader, decision or action, artifact type, and authoritative source.
   Inspect changed code, schemas, commands, configuration, tests, and existing docs.
2. Inventory the claims needed for the task. Classify each as observed behavior,
   an accepted decision, a proposal, or an unresolved gap. Keep those states distinct.
3. Choose a focused structure: prerequisites and steps for a how-to; context,
   decision, and consequences for an ADR; symptoms, diagnosis, recovery, and
   escalation for a runbook. Do not turn every request into a long template.
4. Generate API and command reference from the authoritative registry when one
   exists. Write interpretation and examples without introducing a competing schema.
5. Derive diagrams from real components, calls, state transitions, or data schemas.
   Label omissions and proposed behavior. Do not invent nodes to make a diagram neat.
6. Verify commands, links, examples, and changed documented defaults against the
   source. Run the repository's relevant documentation checks. Update discoverability
   when required, handing site navigation to its owner rather than duplicating it.

## References

Read [document contracts](references/document-contracts.md) for artifact selection,
source coverage, runbook safety, and executable example expectations.

## Completion Criteria

The reader can perform the intended task. Material claims have identifiable
sources, generated boundaries remain intact, and any unexecuted example or
unverified operational step is labeled rather than presented as tested.

Read [provenance](references/provenance.md) when updating this skill.
