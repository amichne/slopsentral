# Source Graph Instructions

## Scope

This file applies to authored marketplace source under `source/`.

## Primitive Contract

- Treat every source-owned skill, agent, hook, instruction, concept, profile,
  eval, and schema as an atomic primitive with one clear responsibility.
- Keep primitives independently useful before any plugin composes them.
- Put primitive ownership in the canonical root for that primitive kind, not in
  a plugin payload or generated provider tree.
- Reference related primitives by stable local paths instead of copying their
  content.
- Use structured manifests, schemas, scripts, or tests to enforce contracts;
  do not rely on prose-only shape agreements for JSON or executable behavior.

## Plugin Scope

- A plugin is an installable composition surface, not a primitive owner.
- `source/plugins/*/plugin.json` may describe plugin metadata and reference
  skills, agents, hooks, instructions, and resources that already exist under `source/`.
- Do not put the only copy of a skill, agent, hook, instruction, concept, or
  schema inside a plugin directory.
- If a plugin needs packaging-only resources, keep them clearly
  plugin-adjacent and do not present them as canonical primitives.

## Skill Standard

- Skills under `source/skills/<name>/` must follow the public skill folder
  standard: required `SKILL.md`, YAML frontmatter with `name` and
  `description`, concise Markdown body, and optional `references/`, `scripts/`,
  `assets/`, `agents/`, or eval/proof assets.
- The folder name, frontmatter `name`, marketplace `name`, and plugin reference
  `name` should match unless there is an explicit migration note and a
  short-lived cleanup plan.
- Keep `SKILL.md` as trigger, workflow, completion criteria, and reference
  router. Move variants, examples, long policies, and executable checks into
  optional bundled resources.
- Do not add README, changelog, installation guide, quick-reference, or status
  files inside a skill unless the skill's output explicitly requires that
  artifact.

## Generated Boundaries

- Edit `source/` as authored source.
- Do not hand-edit generated provider output. The local Pkl projector publishes Codex output
  to `.agents/plugins` and GitHub Copilot output to `.github/plugin` on `main`,
  as well as `harness/codex` and `harness/github-copilot`, from validated source.

## Verify

- Run `uv run --locked tools/marketplace.py validate` after changing primitive
  references, hook metadata, plugin manifests, routing evals, or source graph
  contracts.
- For marketplace publication proof, run the full root `AGENTS.md` marketplace
  validation set.

## Asset Reuse

Use `RESOURCE` for one executable or data file when a consumer does not need
the skill's procedure. Keep the file in its authored skill `scripts/` or
`assets/`, or in `source/schemas/`. Resource references exclude skill entry
points, directories, symlinks, and destination aliases. Their dependencies
may contain only resources. See [workflow resources](../docs/workflow-resources.md).

Each primitive has one canonical source identity. Any plugin may compose that
identity, including through dependencies. Plugins are consumers of assets.
Profiles may select shared skills, agents, and instructions. A profile must
select each hook through one plugin; shared hook packaging does not prove that
a host will execute it once. Check the full dependency closure for that rule.
Keep marketplace identities unique and reject conflicting paths or cycles.
Do not copy payloads into plugin directories. Regenerate `source/CATALOG.md` with
`uv run --locked tools/marketplace.py catalog --out source/CATALOG.md` after composition changes. See
`source/ARCHITECTURE.md` for the primitive responsibilities and evidence limits.

`WORKFLOW_PROFILE.focusSkills` selects skills from the selected plugin closures.
`WORKFLOW_PROFILE.skills` selects more skills from those closures and sets each invocation policy.
The catalog rejects a focus skill or binding outside those closures.
The default Pi projection uses its extension for managed discovery and invocation.
It defaults omitted invocation policies to `either` and excludes managed skills from native discovery.
These fields do not change installation state or user authority.
The content-profile trial resolves this selection during projection.
It emits native skill paths and a plain instruction file without a Pi extension.
