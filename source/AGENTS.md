# Source Graph Instructions

## Scope

This file applies to authored marketplace source under `source/`.

## Primitive Contract

- Treat every skill, agent, hook, instruction, concept, profile, eval, schema,
  and tool as an atomic primitive with one clear responsibility.
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
  skills, agents, hooks, and instructions that already exist under `source/`.
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

- Edit `source/` and `garden/manifests/` as authored source.
- Do not hand-edit `.agents/plugins` or `.github/plugin`; materialize them from
  source when provider output proof is needed.

## Verify

- Run `node source/tools/validate-source-graph.mjs` after changing primitive
  references, hook metadata, plugin manifests, promotion records, routing evals,
  or source graph contracts.
- For marketplace publication proof, run the full root `AGENTS.md` marketplace
  validation set.
