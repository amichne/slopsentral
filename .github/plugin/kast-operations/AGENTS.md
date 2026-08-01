# Kast Operations Plugin Instructions

## Scope

This generated adapter applies to the `kast-operations` plugin payload. Do not edit it directly; update the provider-neutral primitives or plugin manifest, then regenerate the marketplace output.

## Runtime Boundary

The source graph keeps skills, agent profiles, instructions, concepts, and hooks as independent primitives. This `AGENTS.md` adapts bundled agent and instruction primitives into a plain instruction file for runtimes that do not expose those primitive kinds directly.

## Plugin Intent

Operational diagnosis, performance measurement, Kotlin structural analysis, and read-only SQLite navigation for Kast.

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

- `kast-installation-diagnosis`: `skills/kast-installation-diagnosis` (source: `source/skills/kast-installation-diagnosis`)
- `kast-kotlin-structural-analysis`: `skills/kast-kotlin-structural-analysis` (source: `source/skills/kast-kotlin-structural-analysis`)
- `kast-performance-assessment`: `skills/kast-performance-assessment` (source: `source/skills/kast-performance-assessment`)
- `sqlite-readonly-navigation`: `skills/sqlite-readonly-navigation` (source: `source/skills/sqlite-readonly-navigation`)
