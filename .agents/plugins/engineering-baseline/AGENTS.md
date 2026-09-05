# Engineering Baseline Plugin Instructions

## Scope

This generated adapter applies to the `engineering-baseline` plugin payload. Do not edit it directly; update the provider-neutral primitives or plugin manifest, then regenerate the marketplace output.

## Runtime Boundary

The source graph keeps skills, agent profiles, instructions, concepts, and hooks as independent primitives. This `AGENTS.md` adapts bundled agent and instruction primitives into a plain instruction file for runtimes that do not expose those primitive kinds directly.

## Plugin Intent

Engineering outcomes, semantic design, and verification.

## Operating Rules

- Treat this file as an adapter, not a new source of truth.
- Use bundled skills for step-by-step workflows.
- Apply bundled instructions as normative guidance when their scope matches the task.
- Treat bundled agent profiles as review criteria or focused review passes.
- Keep hook behavior in bundled hook files and runtime adapter configs.
- When guidance conflicts with the target repository's nearest `AGENTS.md`, follow the target repository unless the user explicitly chooses this plugin's rule.

## Instruction Primitives

- `type-safety`: `instructions/type-safety.md` (source: `source/concepts/type-safety/core.md`)
- `agent-execution`: `instructions/agent-execution.md` (source: `source/instructions/agent-execution.md`)

## Skill Primitives

- `bounded-delegation`: `skills/bounded-delegation` (source: `source/skills/bounded-delegation`)
- `define-goal`: `skills/define-goal` (source: `source/skills/define-goal`)
- `repository-onboarding`: `skills/repository-onboarding` (source: `source/skills/repository-onboarding`)
- `semantic-ratchet`: `skills/semantic-ratchet` (source: `source/skills/semantic-ratchet`)
- `tdd`: `skills/tdd` (source: `source/skills/tdd`)

## Hook Primitives

- `agents-md-turn-refresh`: `hooks/agents-md-turn-refresh.hooks.json` (source: `source/hooks/agents-md-turn-refresh.hook.json`)
