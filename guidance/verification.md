# Verification

Run the checks for each surface the change touches. `npm run verify` runs the
full local gate. [The toolchain manifest](../tools/toolchain.json) pins every
external tool; run commands outside npm scripts through
`node tools/toolchain.mjs run --`. Missing tools or unassessed effects do not
pass a gate.

## Source graph

After changing primitives, references, hook metadata, plugin manifests, routing
evals, or catalogs:

```bash
node tools/validate-source-graph.mjs
node tools/catalog.mjs --check
node tools/project-marketplaces.mjs --source . --harness codex --out /tmp/slopsentral-codex
node tools/project-marketplaces.mjs --source . --harness github-copilot --out /tmp/slopsentral-github-copilot
node tools/project-marketplaces.mjs --source . --harness amp --out /tmp/slopsentral-amp
git diff --check
```

Run them through `node tools/toolchain.mjs run --`, which supplies the pinned Pkl
through `PKL_BIN`; projection itself never downloads a runtime or replaces an
existing tree. Use fresh output directories.

## Python

Run `npm run check:python` for Ruff, strict Pyright, and pytest under the exact
uv pin. The `python-tooling` skill owns PEP 723, adjacent locks, and portable
execution.

## Prose and explanations

Run `node tools/toolchain.mjs run -- slopsentral-prose changed`, keep its report, and review the
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
