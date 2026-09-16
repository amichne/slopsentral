# Referential Plugin Shape

Use this reference for `source/plugins/<name>/plugin.json` in this repository.

The manifest shape is governed by the source graph contract checked by
`tools/validate-source-graph.mjs`. Validate plugin references with the
repository gate and the focused composition helper:

```sh
node tools/validate-source-graph.mjs
python3 source/skills/plugin-composition-authoring/scripts/check_plugin_composition --plugin <name>
```

## Manifest Pattern

```json
{
  "type": "PLUGIN",
  "schemaVersion": 1,
  "name": "example-family",
  "version": "0.1.0",
  "description": "Capability family composed from independent primitives.",
  "skills": [],
  "agents": [],
  "instructions": [],
  "hooks": [],
  "metadata": {
    "composition": "referential"
  }
}
```

## Primitive References

Each referenced primitive should point to the `source/` graph root as its
source and then to the primitive path:

```json
{
  "type": "SKILL",
  "source": {
    "type": "LOCAL_SOURCE",
    "path": "./"
  },
  "path": "skills/example-skill",
  "name": "example-skill"
}
```

Use the same shape for `AGENT`, `INSTRUCTION`, and `HOOK` references with the
appropriate path and name.

For Codex session-wide concepts, reference a `HOOK` from the plugin and keep
the plugin's `instructions` array empty. The hook metadata owns an
`INSTRUCTION` dependency on `concepts/<name>/core.md`; projection can then copy
the concept into the installed plugin while the hook injects it at
`SessionStart`.

## Rules

- Do not place copied skill or agent directories inside the plugin.
- Do not reference runtime caches or installed marketplace bundles.
- Do not add unsupported schema fields to satisfy a UI wish.
- Do not make installed skills resolve `concepts/*` or `skills/*` as
  repository-relative paths; those roots are source-graph addresses, not skill
  resource paths.
- If a plugin needs non-primitive resources, keep them plugin-adjacent and do
  not confuse them with primitive ownership.
