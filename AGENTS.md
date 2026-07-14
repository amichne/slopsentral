# Repository Instructions

Type safety and verifiability are the default. Treat JSON manifests as
contracts, validate them after edits, and do not patch generated provider output
by hand when the authored source can be fixed instead.

## Marketplace Ownership

- `source/adaptable.marketplace.json` is the provider-neutral marketplace source
  for `slopsentral`.
- `source/plugins/*/plugin.json` composes primitives by reference. Do not copy
  primitive payloads into plugin folders.
- `source/skills`, `source/agents`, `source/hooks`, `source/concepts`,
  `source/profiles`, `source/evals`, `source/schemas`, and `source/tools` are
  canonical authored roots.
- `.agents/plugins` and `.github/plugin` are generated output from
  `intelligence project --source . --harness codex|github-copilot`.
- Installed caches under `~/.codex/plugins/cache` are consumers, never source.

## First-Party Material

Do not make upstream/system skills canonical here. Preserve upstream provenance,
or create a local rewrite with a non-colliding name and explicit intent.

## Required Checks

Run the smallest check that proves the edited surface. For marketplace or plugin
composition edits, run:

```bash
node source/tools/validate-source-graph.mjs
intelligence project --source . --harness codex --out /tmp/slopsentral-codex
intelligence project --source . --harness github-copilot --out /tmp/slopsentral-github-copilot
git diff --check
```
