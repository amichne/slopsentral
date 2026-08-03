# Effective Delivery Plugin Instructions

## Scope

This generated adapter applies to the `effective-delivery` plugin payload. Do not edit it directly; update the provider-neutral primitives or plugin manifest, then regenerate the marketplace output.

## Runtime Boundary

The source graph keeps skills, agent profiles, instructions, concepts, and hooks as independent primitives. This `AGENTS.md` adapts bundled agent and instruction primitives into a plain instruction file for runtimes that do not expose those primitive kinds directly.

## Plugin Intent

Effective software delivery through backend-neutral issue reads, direct dependency evidence, PR follow-through, optimized GitHub Actions workflow graphs, and structured CI observation.

## Operating Rules

- Treat this file as an adapter, not a new source of truth.
- Use bundled skills for step-by-step workflows.
- Apply bundled instructions as normative guidance when their scope matches the task.
- Treat bundled agent profiles as review criteria or focused review passes.
- Keep hook behavior in bundled hook files and runtime adapter configs.
- When guidance conflicts with the target repository's nearest `AGENTS.md`, follow the target repository unless the user explicitly chooses this plugin's rule.

## Instruction Primitives

- `schema-driven-design`: `instructions/schema-driven-design.md` (source: `source/concepts/schema-driven-design/core.md`)
- `type-safety`: `instructions/type-safety.md` (source: `source/concepts/type-safety/core.md`)

## Skill Primitives

- `github-ci-operations`: `skills/github-ci-operations` (source: `source/skills/github-ci-operations`)
- `issue-tracker-operations`: `skills/issue-tracker-operations` (source: `source/skills/issue-tracker-operations`)
- `pull-request-lifecycle`: `skills/pull-request-lifecycle` (source: `source/skills/pull-request-lifecycle`)
