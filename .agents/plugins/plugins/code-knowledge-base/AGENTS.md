# Code Knowledge Base Plugin Instructions

## Scope

This generated adapter applies to the `code-knowledge-base` plugin payload. Do not edit it directly; update the provider-neutral primitives or plugin manifest, then regenerate the marketplace output.

## Runtime Boundary

The source graph keeps skills, agent profiles, instructions, concepts, and hooks as independent primitives. This `AGENTS.md` adapts bundled agent and instruction primitives into a plain instruction file for runtimes that do not expose those primitive kinds directly.

## Plugin Intent

Provider-neutral workflow for OKF knowledge bundles: Kotlin/Gradle concepts, signature-backed routing, code_sources impact checks, and advisory drift hooks.

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

- `code-knowledge-base`: `skills/code-knowledge-base` (source: `source/skills/code-knowledge-base`)
- `reference-doc-workflow`: `skills/reference-doc-workflow` (source: `source/skills/reference-doc-workflow`)
- `repository-signature-indexing`: `skills/repository-signature-indexing` (source: `source/skills/repository-signature-indexing`)
- `site-docs-authoring`: `skills/site-docs-authoring` (source: `source/skills/site-docs-authoring`)

## Hook Primitives

- `code-knowledge-drift`: `hooks/code-knowledge-drift.hooks.json` (source: `source/hooks/code-knowledge-drift.hook.json`)
