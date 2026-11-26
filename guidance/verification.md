# Verification

Run the checks for each surface the change touches. `npm run verify` runs the
full local gate. [The toolchain manifest](../tools/toolchain.json) pins every
external tool used in CI. From a prepared checkout, run
`bin/slopsentral-ci validate` for source validation, documentation freshness,
Python checks, and adapter tests. Its executable header starts uv in locked script mode.

## Source graph

After changing primitives, references, hook metadata, plugin manifests, routing
evals, or catalogs:

```bash
node tools/validate-source-graph.mjs
node tools/catalog.mjs --check
python3 tools/project_marketplaces.py --source . --harness codex --out /tmp/slopsentral-codex
python3 tools/project_marketplaces.py --source . --harness github-copilot --out /tmp/slopsentral-github-copilot
python3 tools/project_marketplaces.py --source . --harness amp --out /tmp/slopsentral-amp
python3 tools/project_marketplaces.py --source . --harness claude --out /tmp/slopsentral-claude
python3 tools/project_marketplaces.py --source . --harness pi --out /tmp/slopsentral-pi
git diff --check
```

Run them through `python3 tools/toolchain.py run --`, which supplies the pinned Pkl
through `PKL_BIN`; projection itself never downloads a runtime or replaces an
existing tree. Use fresh output directories.

## Python

Run `python3 tools/toolchain.py run -- slopsentral-check` for Ruff, strict Pyright, and pytest under the exact
uv pin. The `python-tooling` skill owns PEP 723, adjacent locks, and portable
execution.

## Prose and explanations

Run `python3 tools/toolchain.py run -- slopsentral-prose changed`, keep its report, and review the
located findings. For source changes, examine affected explanations through the
[documentation procedure](../docs/documentation.md). For changed bundled assets,
refresh and verify the portable snapshot through its producer.

## Evaluations

When an example changes a model decision or skill scope, map it to its case owner
in the [evaluation guide](../docs/skill-evals.md) and run `npm run check:evals`.
Keep offline controls, supplied-text decisions, and native execution evidence
distinct.

## Owner-specific checks

The routed owner lists any focused checks for installation, Pi, releases, the
site, and global instructions. Run those in addition to the sections above.
