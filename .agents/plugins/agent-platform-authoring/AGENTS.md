# Agent Platform Authoring Plugin Instructions

## Scope

This generated adapter applies to the `agent-platform-authoring` plugin payload. Do not edit it directly; update the provider-neutral primitives or plugin manifest, then regenerate the marketplace output.

## Runtime Boundary

The source graph keeps skills, agent profiles, instructions, concepts, and hooks as independent primitives. This `AGENTS.md` adapts bundled agent and instruction primitives into a plain instruction file for runtimes that do not expose those primitive kinds directly.

## Plugin Intent

Agent platform authoring package for source-owned skills, agents, hooks, plugin manifests, routing proof, and repository guidance.

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

- `agent-profile-authoring`: `skills/agent-profile-authoring` (source: `source/skills/agent-profile-authoring`)
- `hook-primitive-authoring`: `skills/hook-primitive-authoring` (source: `source/skills/hook-primitive-authoring`)
- `local-repository-navigation`: `skills/local-repository-navigation` (source: `source/skills/local-repository-navigation`)
- `plugin-composition-authoring`: `skills/plugin-composition-authoring` (source: `source/skills/plugin-composition-authoring`)
- `primitive-quality-audit`: `skills/primitive-quality-audit` (source: `source/skills/primitive-quality-audit`)
- `primitive-routing-evaluation`: `skills/primitive-routing-evaluation` (source: `source/skills/primitive-routing-evaluation`)
- `repo-instruction-topology`: `skills/repo-instruction-topology` (source: `source/skills/repo-instruction-topology`)
- `skill-primitive-authoring`: `skills/skill-primitive-authoring` (source: `source/skills/skill-primitive-authoring`)
- `source-graph-consolidation`: `skills/source-graph-consolidation` (source: `source/skills/source-graph-consolidation`)

## Hook Primitives

- `source-graph-valid`: `hooks/source-graph-valid.hooks.json` (source: `source/hooks/source-graph-valid.hook.json`)
