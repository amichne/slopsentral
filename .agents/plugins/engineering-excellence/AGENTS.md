# Engineering Excellence Plugin Instructions

## Scope

This generated adapter applies to the `engineering-excellence` plugin payload. Do not edit it directly; update the provider-neutral primitives or plugin manifest, then regenerate the marketplace output.

## Runtime Boundary

The source graph keeps skills, agent profiles, instructions, concepts, and hooks as independent primitives. This `AGENTS.md` adapts bundled agent and instruction primitives into a plain instruction file for runtimes that do not expose those primitive kinds directly.

## Plugin Intent

Encode invariants in types and contracts, preserve established proofs, and make illegal states unrepresentable.

## Operating Rules

- Treat this file as an adapter, not a new source of truth.
- Use bundled skills for step-by-step workflows.
- Apply bundled instructions as normative guidance when their scope matches the task.
- Treat bundled agent profiles as review criteria or focused review passes.
- Keep hook behavior in bundled hook files and runtime adapter configs.
- When guidance conflicts with the target repository's nearest `AGENTS.md`, follow the target repository unless the user explicitly chooses this plugin's rule.

## Instruction Primitives

- `engineering-design`: `instructions/engineering-design.md` (source: `source/instructions/engineering-design.md`)

## Skill Primitives

- `semantic-ratchet`: `skills/semantic-ratchet` (source: `source/skills/semantic-ratchet`)

## Hook Primitives

- `engineering-excellence-context`: `hooks/engineering-excellence-context.hooks.json` (source: `source/hooks/engineering-excellence-context.hook.json`)
