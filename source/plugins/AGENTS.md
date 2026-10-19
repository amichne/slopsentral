# Plugin Source Instructions

## Scope

This file applies to `source/plugins/`.

## Contract

- Keep each `plugin.json` small, declarative, and referential.
- Compose only primitives that already exist under canonical `source/` roots.
- Use `LOCAL_SOURCE` with path `"./"` and primitive paths such as
  `skills/<name>`, `agents/<file>`, `hooks/<name>.hook.json`, or
  `concepts/<name>/core.md`.
- Prefer standard skills with selectively loaded references.
  Compose a context hook only for explicitly selected host integration.
  Keep direct `instructions` empty for session policy.
  The generated plugin index does not deliver model context.
- Do not copy primitive payloads, generated provider output, runtime caches, or
  installed plugin bundles into plugin directories.
- A plugin may keep an authored `.mcp.json` beside `plugin.json` when
  `codexMcpServers` references it. The projector validates and copies this
  Codex-only packaging file; server implementation remains external.
- Set `metadata.role` to `default`, `specialty`, or `advanced`; the catalog
  requires exactly one default. Keep `scope`, `dailyDriver`, and `notFor`
  specific enough to explain the task that makes this plugin useful.
- Package recognizable user jobs. Preserve focused skills inside each plugin;
  installing a bundle does not require every skill to run.

## Verify

- Run `uv run --locked tools/marketplace.py validate`.
- For focused composition checks, run
  `python3 source/skills/plugin-composition-authoring/scripts/check_plugin_composition --plugin <name>`.
