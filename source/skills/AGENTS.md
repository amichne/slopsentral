# Skill Source Instructions

## Scope

This file applies to `source/skills/`.

## Public Skill Standard

- Every skill folder must contain `SKILL.md` with YAML frontmatter containing
  `name` and `description`.
- The folder name must match frontmatter `name` for new or cleaned-up skills.
- Use lower-case hyphenated names.
- Write `description` as trigger text: what the skill does and when an agent
  should use it.
- Keep `SKILL.md` concise and procedural. It should define the trigger,
  workflow, reference routing, and completion criteria.

## Bundled Resources

- Put optional details in one-level `references/` files and link them from
  `SKILL.md` with a condition for when to read each file.
- Put deterministic repeated work in `scripts/`.
- Put output resources in `assets/`.
- Put UI-facing metadata in `agents/openai.yaml` only when the skill needs it.
- Keep eval or proof assets inside the skill only when they are durable inputs,
  not transient benchmark output.

## Do Not Add

- Do not add README, changelog, installation guide, quick-reference, or status
  files inside a skill unless the skill's output explicitly requires that file.
- Do not make a skill depend on being installed through a plugin; plugins may
  compose skills, but the skill must stand alone.
- Do not raw-copy first-party skills into local canonical names. Preserve
  provenance or create a local rewrite with a non-colliding name.

## Verify

- Run `node source/tools/validate-source-graph.mjs` after skill frontmatter,
  marketplace references, or plugin references change.
