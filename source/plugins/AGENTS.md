# Plugin Source Instructions

## Scope

This file applies to `source/plugins/`.

## Contract

- Keep each `plugin.json` small, declarative, and referential.
- Compose only primitives that already exist under canonical `source/` roots.
- Use `LOCAL_SOURCE` with path `"./"` and primitive paths such as
  `skills/<name>`, `agents/<file>`, `hooks/<name>.hook.json`, or
  `concepts/<name>/core.md`.
- Do not copy primitive payloads, generated provider output, runtime caches, or
  installed plugin bundles into plugin directories.
- Keep routing metadata such as `role`, `scope`, `dailyDriver`, and `notFor`
  specific enough to distinguish the plugin from neighboring capability
  families.

## Verify

- Run `node source/tools/validate-source-graph.mjs`.
- For focused composition checks, run
  `python3 source/skills/plugin-composition-authoring/scripts/check_plugin_composition.py --plugin <name>`.
