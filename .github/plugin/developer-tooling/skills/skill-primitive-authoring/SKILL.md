---
name: "skill-primitive-authoring"
description: "Create, consolidate, or assess reusable skills and agent profiles. Use for trigger design, delegated scope, routing evidence, references, scripts, or promotion."
---

# Skill Primitive Authoring

Give each reusable workflow one owner, one trigger, and an explicit result.
Use this skill for skills, agent profiles, and routing evidence.
Use `plugin-composition-authoring` for installable compositions, hooks, and repository instruction scope.

## Contract

Start from repeated work, a concrete request, or a source-backed failure.
Inspect existing primitives before a new design.
Extend an existing owner when its scope covers the work.
Keep skills and agents useful without plugin text or host-specific metadata.
Preserve public-safe provenance and avoid names from upstream system skills.
Classify supplied notes as evidence, normative requirements, or requested bundled
resources before copying anything. Evidence clarifies the rule; it is not a
request to distribute the notes, private examples, or their entire workflow.
Bundle only material whose inclusion is requested or necessary for the consumer,
with the applicable provenance and distribution authority.

Keep `SKILL.md` as a focused router.
Place concrete variants and examples in references.
Use scripts for deterministic work with a real consumer.
Default new automation to `python-tooling`: required uv, PEP 723, committed locks, `tool.uv.no-build = true`, strict Pyright, Ruff, and pytest.
Keep decisions pure and effect adapters explicit.

## Workflow

1. Name the consumer, accepted input, protected invariant, authorized scope, and result.
2. Find overlapping skills or agents and choose reuse, extension, consolidation, or a new owner.
3. Write realistic trigger cases, a nearest non-trigger, and the evidence that separates them.
4. For agent profiles, define delegated ownership, excluded work, tool access, stop conditions, and returned evidence.
5. Define a focused executable assertion or a recorded assessment with an explicit evidence limit.
   Historical traces diagnose a candidate fix; they do not measure the edited
   instructions. Fresh model comparisons need their own applicable authority.
   Keep evidence-only notes and raw transcripts outside the distributed package.
6. Keep one procedure for shared work and route case-specific details through the references.
7. Examine frontmatter, links, scripts, schemas, provenance, and composition through the repository gates.
8. Report the changed owner, passing assertions, remaining findings, and absent model evidence.

## References

- Read [layout](references/progressive-disclosure.md) to choose between the router, references, scripts, and assets.
- Read [agent profiles](references/agent-profiles.md) for delegation prompts, tool scope, and trigger examples.
- Read [routing evidence](references/routing-evidence.md) for missed, incorrect, or bypassed routes and durable eval cases.
- Read [evaluation](references/evaluation-scaffold.md) for cases, holdouts, comparison baselines, and consolidation evidence.
- Read [interface adapters](references/interface-adapters.md) for host-specific metadata.

## Completion

Each supported task has one discoverable owner and a specific success condition.
Review the shipped file set: each bundled resource has a consumer and an
inclusion reason, not merely a mention in the conversation.
Structured output has a schema or typed parser.
Fixture consistency proves the fixture contract only.
A model-routing claim needs a real trace or an explicitly limited recorded report.
