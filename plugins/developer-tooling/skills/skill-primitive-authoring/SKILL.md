---
name: "skill-primitive-authoring"
description: "Create, revise, consolidate, or assess reusable skills and agent profiles. Use for trigger design, delegated scope, routing evidence, resources, or promotion. Using unchanged skills needs no authoring workflow."
---

# Skill Primitive Authoring

Give each reusable workflow one owner, one trigger, and an explicit result.
When changing the decisions expressed by instructions, use model-instruction-design.
When review examples judge a model decision or scope, use
`promptfoo-eval-construction` to capture them as cases in the same pull request.
When changing installable compositions, hooks, or repository instruction scope,
use `plugin-composition-authoring`.

## Contract

Start from repeated work, a concrete request, or a source-backed failure.
Keep skills and agents useful without plugin text or host-specific metadata.
Preserve public-safe provenance and avoid names from upstream system skills.
Classify supplied notes as evidence, normative requirements, or requested resources
before copying. Evidence does not authorize distributing notes, private examples,
or their workflow. Bundle only requested material or resources needed by a
consumer, with applicable provenance and distribution authority.

Keep `SKILL.md` as a focused router.
Place concrete variants and examples in references.
When deterministic work has a real consumer, reuse an existing script or add
the missing operation. Use `python-tooling` for automation and use PEP 723
headers and adjacent locks for portable scripts. Use strict
Pyright, Ruff, and pytest. Keep decisions pure and effect adapters explicit.

## Workflow

1. Name the consumer, accepted input, protected invariant, authorized scope, and result.
2. Inspect overlapping skills or agents. Reuse an owner that already meets the
   contract; extend it for a missing supported branch. Consolidate only when
   the same responsibility has competing owners. Add a new primitive when the
   existing scopes cannot own the requested workflow.
3. Write realistic trigger cases, a nearest non-trigger, and the evidence that separates them.
4. For agent profiles, define delegated ownership, excluded work, tool access, stop conditions, and returned evidence.
5. Define a focused executable assertion or a recorded assessment with an explicit evidence limit.
   Historical traces diagnose a candidate fix; they do not measure the edited
   instructions. Fresh model comparisons need their own applicable authority.
   Keep evidence-only notes and raw transcripts outside the distributed package.
6. Keep one procedure for shared work. Put its trigger in discoverable metadata
   and its first decision in `SKILL.md`. Link case-specific details with the
   condition that makes each reference necessary.
7. Examine frontmatter, links, scripts, schemas, provenance, and composition through the repository gates.
8. Report the changed owner, passing assertions, remaining findings, and absent model evidence.

## References

- Read [layout](references/progressive-disclosure.md) to choose between the router, references, scripts, and assets.
- When authoring or changing an agent profile, read
  [agent profiles](references/agent-profiles.md) for delegation prompts, tool scope, and trigger examples.
- Read [routing evidence](references/routing-evidence.md) for missed, incorrect, or bypassed routes and durable eval cases.
- When designing a comparison or evaluating consolidation, read
  [evaluation](references/evaluation-scaffold.md) for cases, holdouts, and baselines.
- When changing host-specific metadata, read
  [interface adapters](references/interface-adapters.md).

## Completion

Each supported task has one discoverable owner and a specific success condition.
Review the shipped file set: each bundled resource has a consumer and an
inclusion reason, not merely a mention in the conversation.
Structured output has a schema or typed parser.
Fixture consistency proves the fixture contract only.
A model-routing claim needs a real trace or an explicitly limited recorded report.
