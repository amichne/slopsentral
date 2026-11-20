# Source graph

Read this before changing anything under `source/skills`, `source/agents`,
`source/hooks`, `source/plugins`, `source/profiles`, `source/instructions`,
`source/schemas`, `source/adaptable.marketplace.json`, or the generated catalogs.
[Architecture](../source/ARCHITECTURE.md) explains the owners and evidence limits.
Portable concepts follow [their own instructions](../source/concepts/AGENTS.md).

## Primitives

- Each skill, agent, hook, instruction, concept, profile, eval, and schema is an
  atomic primitive with one responsibility, owned under its kind's root in
  `source/`. It stays useful without any plugin.
- `source/adaptable.marketplace.json` owns each primitive's single identity.
  Keep identities unique; reject conflicting paths and cycles.
- Reference related primitives by stable path or name; do not copy their content.
- Enforce JSON and executable contracts with manifests, schemas, scripts, or
  tests rather than prose agreements.
- For an existing procedure, inspect its canonical owner and current consumers,
  then refine it. Create a primitive only when the graph has no suitable owner.
- Keep upstream and system skills outside local ownership. Preserve provenance,
  or make a local rewrite with a distinct name. Keep public-safe provenance for
  imported agents and hooks.

## Skills

- `source/skills/<name>/SKILL.md` has YAML frontmatter with `name` and
  `description`. The folder name, `name`, marketplace name, and plugin reference
  match; use lower-case hyphenated names.
- `description` is the trigger: what the skill does and when to use it. The
  catalogs derive from it, so run `node tools/catalog.mjs --write` after a
  trigger or composition change.
- Keep `SKILL.md` to the trigger, workflow, completion criteria, and reference
  router. State each reference's condition before its link.
- Put details in one-level `references/`, repeated deterministic work in
  `scripts/`, output resources in `assets/`, and UI metadata in
  `agents/openai.yaml` only when needed. Keep only durable eval or proof inputs.
- Do not add README, changelog, installation, quick-reference, or status files
  unless the skill's output requires one.
- A skill stands alone. Address other skills by name and link only its own
  bundled resources. Do not assume plugin instructions or other context loaded.

## Agents

- Store provider-neutral profiles in Markdown; adapters project them later.
- Reference concepts by repository-relative path, such as
  `source/concepts/type-safety/core.md`.
- Review agents lead with findings by severity. Each finding names the object,
  criteria, evidence, baseline, and confidence. With no finding, say so and name
  the residual uncertainty.

## Hooks

- Store provider-neutral metadata in `*.hook.json` and adapter projections in
  adapter directories such as `source/hooks/codex/`. Keep executables at the
  hook root unless adapter-specific.
- Declare related skills, agents, and concepts in `dependsOn` instead of
  embedding their guidance. Use a `RESOURCE` dependency for one executable or
  data file; use a `SKILL` dependency only when the procedure is required.
- Codex context injection uses a `SessionStart` adapter that emits
  `hookSpecificOutput.additionalContext` and reads dependencies through
  `PLUGIN_ROOT`, not the source tree.

## Plugins and profiles

- Keep `plugin.json` small, declarative, and referential. Compose existing
  primitives with `LOCAL_SOURCE`, path `"./"`, and primitive paths such as
  `skills/<name>` or `hooks/<name>.hook.json`.
- Deliver session-wide policy through a context hook whose `dependsOn` names
  `instructions/` primitives; keep direct `instructions` empty. Leave full
  concepts in selectively loaded references.
- Never put the only copy of a primitive, generated output, or cache in a plugin
  directory. Keep packaging-only files plugin-adjacent, such as a `.mcp.json`
  referenced by `codexMcpServers`.
- Set `metadata.role` to `default`, `specialty`, or `advanced`, with exactly one
  default. Make `scope`, `dailyDriver`, and `notFor` specific to the user job.
- A profile may select shared skills, agents, and instructions, but must select
  each hook through one plugin across its full dependency closure.

## Resources

Use `RESOURCE` for one executable or data file when a consumer does not need the
skill's procedure. Keep it in the skill's `scripts/` or `assets/`, or in
`source/schemas/`. Resources exclude skill entry points, directories, symlinks,
and destination aliases, and depend only on resources. See
[workflow resources](../docs/workflow-resources.md).

## Generated output

Never edit generated provider output by hand. The Pkl projector publishes Codex
output to `.agents/plugins` and GitHub Copilot output to `.github/plugin` on
`main`, and to the `harness/codex` and `harness/github-copilot` branches.

## Checks

Run the [source graph checks](verification.md#source-graph). Also run syntax
checks for each touched hook executable, and for one plugin's composition:

```bash
uv run --locked --script source/skills/plugin-composition-authoring/scripts/check_plugin_composition --plugin <name>
```
