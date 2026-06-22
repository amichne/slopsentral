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

## Local Generated Output Ignore

The provider trees are committed for marketplace consumers, but developers
should edit `source/` and let automation refresh `.agents/plugins/` and
`.github/plugin/`. To keep local status focused on authored files, run:

```bash
node source/tools/configure-local-generated-output-ignore.mjs enable
```

That command updates this clone's `.git/info/exclude` and marks currently
tracked provider files with Git's local `skip-worktree` flag. The state is not
committed and is not inherited by GitHub Actions. To inspect or undo it:

```bash
node source/tools/configure-local-generated-output-ignore.mjs status
node source/tools/configure-local-generated-output-ignore.mjs disable
```

## Validation

```bash
node source/tools/validate-source-graph.mjs
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
- `garden/manifests/cleanup-ledger.json` records skipped duplicates, upstream
  exclusions, and deferred cleanup decisions.
