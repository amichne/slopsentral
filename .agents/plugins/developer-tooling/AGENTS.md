# Developer Tooling Plugin Instructions

## Scope

This generated adapter applies to the `developer-tooling` plugin payload. Do not edit it directly; update the provider-neutral primitives or plugin manifest, then regenerate the marketplace output.

## Runtime Boundary

The source graph keeps skills, agent profiles, instructions, concepts, and hooks as independent primitives. This `AGENTS.md` adapts bundled agent and instruction primitives into a plain instruction file for runtimes that do not expose those primitive kinds directly.

## Plugin Intent

Author typed Python tools, schemas, Pkl contracts, and agent resources. Install language servers and ast-grep or change requested personal configuration.

## Operating Rules

- Treat this file as an adapter, not a new source of truth.
- Use bundled skills for step-by-step workflows.
- Apply bundled instructions as normative guidance when their scope matches the task.
- Treat bundled agent profiles as review criteria or focused review passes.
- Keep hook behavior in bundled hook files and runtime adapter configs.
- When guidance conflicts with the target repository's nearest `AGENTS.md`, follow the target repository unless the user explicitly chooses this plugin's rule.

## Agent Profile Primitives

- `openapi-contract-rater`: `agents/openapi-contract-rater.agent.md` (source: `source/agents/openapi/openapi-contract-rater.agent.md`)
- `schema-type-enforcer`: `agents/schema-type-enforcer.agent.md` (source: `source/agents/schema-type-enforcer.agent.md`)

## Skill Primitives

- `ast-grep`: `skills/ast-grep` (source: `source/skills/ast-grep`)
- `cli-creator`: `skills/cli-creator` (source: `source/skills/cli-creator`)
- `lsp-management`: `skills/lsp-management` (source: `source/skills/lsp-management`)
- `manage-json-schemas`: `skills/manage-json-schemas` (source: `source/skills/manage-json-schemas`)
- `openapi-contract-authoring`: `skills/openapi-contract-authoring` (source: `source/skills/openapi-contract-authoring`)
- `personal-setup-management`: `skills/personal-setup-management` (source: `source/skills/personal-setup-management`)
- `pkl-engineering`: `skills/pkl-engineering` (source: `source/skills/pkl-engineering`)
- `plugin-composition-authoring`: `skills/plugin-composition-authoring` (source: `source/skills/plugin-composition-authoring`)
- `python-tooling`: `skills/python-tooling` (source: `source/skills/python-tooling`)
- `skill-primitive-authoring`: `skills/skill-primitive-authoring` (source: `source/skills/skill-primitive-authoring`)
