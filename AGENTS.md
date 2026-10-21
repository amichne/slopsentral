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
  `source/profiles`, `source/evals`, `source/schemas`, and `tools` are
  canonical authored roots.
- Generated provider output is published on `main` under `.agents/plugins`
  (Codex) and `.github/plugin` (GitHub Copilot), and on the corresponding
  `harness/codex` and `harness/github-copilot` branches.
- Regenerate these trees from validated authored source with the local Pkl projector; never
  hand-edit them. Publication updates both trees on `main` in one commit and
  preserves all authored files.
- Installed caches under `~/.codex/plugins/cache` are consumers, never source.

## First-Party Material

Do not make upstream/system skills canonical here. Preserve upstream provenance,
or create a local rewrite with a non-colliding name and explicit intent.

## Required Checks

Run the smallest check that proves the edited surface. For marketplace or plugin
composition edits, run:

```bash
node tools/validate-source-graph.mjs
node tools/project-marketplaces.mjs --source . --harness codex --out /tmp/slopsentral-codex
node tools/project-marketplaces.mjs --source . --harness github-copilot --out /tmp/slopsentral-github-copilot
git diff --check
```

The projector requires Pkl 0.32.0 (`PKL_BIN` may select an explicit executable).
Use fresh output directories. Projection never downloads a runtime or replaces
an existing tree. `node tools/install-projection-pkl.mjs --out <path>` is the
explicit checksum-verified runtime setup boundary.

## Shared Engineering Baseline

Read and apply [the canonical engineering baseline](source/instructions/engineering-design.md)
for all work. Software Engineering delivers this same source through its context
hook; language and domain instructions refine it.

New automation uses required uv, strict Pyright, Ruff, pytest, PEP 723 metadata,
locked dependencies, and `tool.uv.no-build = true`. Run `uv run --locked tools/check.py`
for the Python boundary checks. Use `uv run --locked tools/setup.py` for explicit
checkout setup. Keep generated outputs and installed caches outside authored edits.

## Portable Global Instructions

`tools/install_global_agents.py` owns the portable installation and its local
reference snapshot. `tools/global_agents.lock.json` pins the source assets.
The [source map](docs/global-agents.md) describes the installation contract.

After changing a bundled source, review its effect on the portable guidance.
Refresh its digests with `uv run --locked tools/install_global_agents.py manifest --write`.
Run `uv run --locked tools/install_global_agents.py manifest` to examine freshness.
Keep installed `.slopsentral` snapshots outside authored edits.
