# Kotlin Engineering Plugin Instructions

## Scope

This generated adapter applies to the `kotlin-engineering` plugin payload. Do not edit it directly; update the provider-neutral primitives or plugin manifest, then regenerate the marketplace output.

## Runtime Boundary

The source graph keeps skills, agent profiles, instructions, concepts, and hooks as independent primitives. This `AGENTS.md` adapts bundled agent and instruction primitives into a plain instruction file for runtimes that do not expose those primitive kinds directly.

## Plugin Intent

Kotlin best-practices package for type-driven design, parse-dont-validate APIs, Kast-backed navigation, focused review, Gradle proof, Gradle wrapper integrity, and Kotlin package-layout hooks. Use kotlin-repo-default when branch, PR, CI, or release delivery is also required.

## Operating Rules

- Treat this file as an adapter, not a new source of truth.
- Use bundled skills for step-by-step workflows.
- Apply bundled instructions as normative guidance when their scope matches the task.
- Treat bundled agent profiles as review criteria or focused review passes.
- Keep hook behavior in bundled hook files and runtime adapter configs.
- When guidance conflicts with the target repository's nearest `AGENTS.md`, follow the target repository unless the user explicitly chooses this plugin's rule.

## Instruction Primitives

- `kotlin-code-correctness`: `instructions/kotlin-code-correctness.md` (source: `source/concepts/kotlin-code-correctness/core.md`)
- `schema-driven-design`: `instructions/schema-driven-design.md` (source: `source/concepts/schema-driven-design/core.md`)
- `type-safety`: `instructions/type-safety.md` (source: `source/concepts/type-safety/core.md`)

## Agent Profile Primitives

- `kotlin-boundary-contract-reviewer`: `agents/kotlin-boundary-contract-reviewer.agent.md` (source: `source/agents/kotlin-review/kotlin-boundary-contract-reviewer.agent.md`)
- `kotlin-package-cohesion-reviewer`: `agents/kotlin-package-cohesion-reviewer.agent.md` (source: `source/agents/kotlin-review/kotlin-package-cohesion-reviewer.agent.md`)
- `kotlin-review-captain`: `agents/kotlin-review-captain.agent.md` (source: `source/agents/kotlin-review/kotlin-review-captain.agent.md`)
- `kotlin-type-safety-reviewer`: `agents/kotlin-type-safety-reviewer.agent.md` (source: `source/agents/kotlin-review/kotlin-type-safety-reviewer.agent.md`)

## Skill Primitives

- `kotlin-agentic-correctness`: `skills/kotlin-agentic-correctness` (source: `source/skills/kotlin-agentic-correctness`)
- `kotlin-design-practices`: `skills/kotlin-design-practices` (source: `source/skills/kotlin-design-practices`)
- `kotlin-gradle-validation`: `skills/kotlin-gradle-validation` (source: `source/skills/kotlin-gradle-validation`)
- `kotlin-review`: `skills/kotlin-review` (source: `source/skills/kotlin-review`)
- `negative-capability-proof`: `skills/negative-capability-proof` (source: `source/skills/negative-capability-proof`)

## Hook Primitives

- `gradle-check-green`: `hooks/gradle-check-green.hooks.json` (source: `source/hooks/gradle-check-green.hook.json`)
- `gradle-wrapper-integrity`: `hooks/gradle-wrapper-integrity.hooks.json` (source: `source/hooks/gradle-wrapper-integrity.hook.json`)
- `kotlin-horizontalization-check`: `hooks/kotlin-horizontalization-check.hooks.json` (source: `source/hooks/kotlin-horizontalization-check.hook.json`)
