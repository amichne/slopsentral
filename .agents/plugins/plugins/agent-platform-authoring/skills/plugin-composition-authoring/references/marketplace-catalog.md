# Marketplace Catalog

Use this reference when editing `source/adaptable.marketplace.json`.

The catalog shape is governed by the source graph contract checked by
`source/tools/validate-source-graph.mjs`. Use provider materialization only as
proof after source validation passes:

```sh
node source/tools/validate-source-graph.mjs
intelligence validate --repo . --portable
intelligence marketplace materialize --repo . --provider all --out /tmp/slopsentral-marketplace
intelligence validate --repo . --portable --hydrated /tmp/slopsentral-marketplace
```

## Catalog Duties

The marketplace exposes the local source graph. It should list installable
plugin families and standalone primitives that should be discoverable.

## Plugin Entries

Each plugin entry should include:

- `type: "PLUGIN_ENTRY"`;
- a stable `name`;
- a local source path under `./plugins/<name>` relative to `source/`;
- the plugin version;
- a concise description;
- tags that describe capability, not provenance.

## Primitive Entries

Standalone skills, agents, hooks, and concepts should remain listed from their
canonical roots. Do not remove a primitive from the catalog merely because a
plugin also composes it.

## Review Checks

- Source paths exist.
- Plugin names match their manifest names.
- New skills are listed once under `skills`.
- New agents are listed once under `agents`.
- Tags are consistent with neighboring entries.
- The catalog validates with `node source/tools/validate-source-graph.mjs`.
