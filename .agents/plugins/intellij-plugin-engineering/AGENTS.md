# Intellij Plugin Engineering Plugin Instructions

## Scope

This generated adapter applies to the `intellij-plugin-engineering` plugin payload. Do not edit it directly; update the provider-neutral primitives or plugin manifest, then regenerate the marketplace output.

## Runtime Boundary

The source graph keeps skills, agent profiles, instructions, concepts, and hooks as independent primitives. This `AGENTS.md` adapts bundled agent and instruction primitives into a plain instruction file for runtimes that do not expose those primitive kinds directly.

## Plugin Intent

IntelliJ Platform plugin engineering workflow for repository-first implementation, Kotlin and Gradle proof, programmatic Starter/Driver UI tests, Plugin Verifier, Kast exact-root IDEA delivery, Git hygiene, pull requests, and CI.

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

## Skill Primitives

- `git-change-flow`: `skills/git-change-flow` (source: `source/skills/git-change-flow`)
- `github-ci-operations`: `skills/github-ci-operations` (source: `source/skills/github-ci-operations`)
- `intellij-plugin-delivery`: `skills/intellij-plugin-delivery` (source: `source/skills/intellij-plugin-delivery`)
- `kotlin-agentic-correctness`: `skills/kotlin-agentic-correctness` (source: `source/skills/kotlin-agentic-correctness`)
- `kotlin-gradle-validation`: `skills/kotlin-gradle-validation` (source: `source/skills/kotlin-gradle-validation`)
- `pull-request-lifecycle`: `skills/pull-request-lifecycle` (source: `source/skills/pull-request-lifecycle`)
- `tdd`: `skills/tdd` (source: `source/skills/tdd`)
