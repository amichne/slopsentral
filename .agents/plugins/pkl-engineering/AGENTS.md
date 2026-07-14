# Pkl Engineering Plugin Instructions

## Scope

This generated adapter applies to the `pkl-engineering` plugin payload. Do not edit it directly; update the provider-neutral primitives or plugin manifest, then regenerate the marketplace output.

## Runtime Boundary

The source graph keeps skills, agent profiles, instructions, concepts, and hooks as independent primitives. This `AGENTS.md` adapts bundled agent and instruction primitives into a plain instruction file for runtimes that do not expose those primitive kinds directly.

## Plugin Intent

Pkl engineering package for typed specification, first-party source navigation, toolchain and LSP setup, practical and advanced patterns, safe evaluation, rendering, tests, packages, and repository proof hooks.

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

- `pkl-engineering`: `skills/pkl-engineering` (source: `source/skills/pkl-engineering`)
- `pkl-pattern-catalogs`: `skills/pkl-pattern-catalogs` (source: `source/skills/pkl-pattern-catalogs`)
- `pkl-specification`: `skills/pkl-specification` (source: `source/skills/pkl-specification`)
- `pkl-tooling-setup`: `skills/pkl-tooling-setup` (source: `source/skills/pkl-tooling-setup`)

## Hook Primitives

- `pkl-evaluate-check`: `hooks/pkl-evaluate-check.hooks.json` (source: `source/hooks/pkl-evaluate-check.hook.json`)
- `pkl-format-check`: `hooks/pkl-format-check.hooks.json` (source: `source/hooks/pkl-format-check.hook.json`)
- `pkl-test-check`: `hooks/pkl-test-check.hooks.json` (source: `source/hooks/pkl-test-check.hook.json`)
