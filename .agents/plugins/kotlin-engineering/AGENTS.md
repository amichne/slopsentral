# Kotlin Engineering Plugin Instructions

## Scope

This generated adapter applies to the `kotlin-engineering` plugin payload. Do not edit it directly; update the provider-neutral primitives or plugin manifest, then regenerate the marketplace output.

## Runtime Boundary

The source graph keeps skills, agent profiles, instructions, concepts, and hooks as independent primitives. This `AGENTS.md` adapts bundled agent and instruction primitives into a plain instruction file for runtimes that do not expose those primitive kinds directly.

## Plugin Intent

Kotlin implementation, API design, and compiler-backed review.

## Operating Rules

- Treat this file as an adapter, not a new source of truth.
- Use bundled skills for step-by-step workflows.
- Apply bundled instructions as normative guidance when their scope matches the task.
- Treat bundled agent profiles as review criteria or focused review passes.
- Keep hook behavior in bundled hook files and runtime adapter configs.
- When guidance conflicts with the target repository's nearest `AGENTS.md`, follow the target repository unless the user explicitly chooses this plugin's rule.

## Instruction Primitives

- `kotlin-engineering`: `instructions/kotlin-engineering.md` (source: `source/instructions/kotlin-engineering.md`)

## Skill Primitives

- `kotlin-agentic-correctness`: `skills/kotlin-agentic-correctness` (source: `source/skills/kotlin-agentic-correctness`)
- `kotlin-api-surface-design`: `skills/kotlin-api-surface-design` (source: `source/skills/kotlin-api-surface-design`)
- `kotlin-application-stack`: `skills/kotlin-application-stack` (source: `source/skills/kotlin-application-stack`)
- `kotlin-branching`: `skills/kotlin-branching` (source: `source/skills/kotlin-branching`)
- `kotlin-design-practices`: `skills/kotlin-design-practices` (source: `source/skills/kotlin-design-practices`)
- `kotlin-gradle-validation`: `skills/kotlin-gradle-validation` (source: `source/skills/kotlin-gradle-validation`)
- `kotlin-observability-design`: `skills/kotlin-observability-design` (source: `source/skills/kotlin-observability-design`)
- `kotlin-review`: `skills/kotlin-review` (source: `source/skills/kotlin-review`)
- `negative-capability-proof`: `skills/negative-capability-proof` (source: `source/skills/negative-capability-proof`)

## Hook Primitives

- `gradle-check-green`: `hooks/gradle-check-green.hooks.json` (source: `source/hooks/gradle-check-green.hook.json`)
- `gradle-wrapper-integrity`: `hooks/gradle-wrapper-integrity.hooks.json` (source: `source/hooks/gradle-wrapper-integrity.hook.json`)
- `kotlin-horizontalization-check`: `hooks/kotlin-horizontalization-check.hooks.json` (source: `source/hooks/kotlin-horizontalization-check.hook.json`)
