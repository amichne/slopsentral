# Slopsentral

Slopsentral is the canonical marketplace for reusable local AI tooling skills,
plugins, hooks, agents, concepts, and workflow profiles.

## Source Of Truth

- Edit authored primitives under `source/`.
- Keep routing and quality evaluation cases under `source/evals/`; they are
  source evidence, not generated marketplace output.
- Keep source-graph schemas under `source/schemas/` and reusable validation
  utilities under `source/tools/`.
- Treat `.agents/plugins/` and `.github/plugin/` as generated provider output.
- Prefer this repository over installed plugin caches such as
  `~/.codex/plugins/cache`.
- Do not re-own first-party or system skills here. Reference upstream
  distributions or author local rewrites with non-colliding names.

## Validation

```bash
node source/tools/validate-source-graph.mjs
node source/tools/run-routing-evals.mjs
intelligence validate --repo /Users/amichne/code/slopsentral --portable
intelligence marketplace browse --provider source --format json /Users/amichne/code/slopsentral
intelligence marketplace materialize --repo /Users/amichne/code/slopsentral --provider codex --out /tmp/slopsentral-codex
intelligence validate --repo /Users/amichne/code/slopsentral --portable --hydrated /tmp/slopsentral-codex
intelligence marketplace materialize --repo /Users/amichne/code/slopsentral --provider github --out /tmp/slopsentral-github
intelligence validate --repo /Users/amichne/code/slopsentral --portable --hydrated /tmp/slopsentral-github
intelligence marketplace publish --repo /Users/amichne/code/slopsentral
intelligence validate --repo /Users/amichne/code/slopsentral --portable --hydrated /Users/amichne/code/slopsentral
git diff --check
```

## Provenance

- `garden/manifests/promotions.json` records promoted source roots.
- `garden/manifests/primitive-audits.json` records production-readiness and
  quality decisions for primitive families.
- `garden/manifests/cleanup-ledger.json` records skipped duplicates, upstream
  exclusions, and deferred cleanup decisions.
