# Contribute and maintain

Change canonical source, run the gates for that surface, and regenerate affected consumers.
[Key aspects of the codebase](../codebase.md) maps the owners.

## Prepare a checkout

Install mise, Node.js, and npm.
Review `mise.toml` before `mise trust`.
Then prepare locked dependencies:

```sh
mise install
mise exec -- slopsentral-setup
```

The projector needs Pkl 0.32.0.
If it is absent, install the pinned runtime explicitly:

```sh
node tools/install-projection-pkl.mjs --out /tmp/slopsentral-pkl/pkl
```

Set `PKL_BIN` to that executable.
For the command from source, run:

```sh
mise exec -- uv run --locked --script tools/slopsentral.py self install
```

The [Worktrunk runbook](../worktrunk-automation.md) describes hooks for CLI-owned worktrees.
Host-managed worktrees keep their host lifecycle.

## Choose the smallest gate

| Changed surface | Gate |
| --- | --- |
| Python automation | `mise exec -- slopsentral-check` |
| Marketplace or plugin composition | Graph and fresh provider projections in [plugins and profiles](composition.md#admission-and-projection) |
| Pi installer or release | `npm run check:pi`, Pi Node tests, and focused Python Pi tests |
| Unified releases | `npm run check:release` and `node --test tools/tests/release-please.test.mjs` |
| Evaluations | `npm run check:evals` |
| Prose | `mise exec -- slopsentral-prose changed` |
| Documentation | `mise exec -- slopsentral-docs check` and `npm run docs:check` |

[Repository instructions](../../AGENTS.md) define the exact surface-specific commands.
`npm run verify` combines repository gates for integration.
A skipped gate supplies no passing evidence.

## Maintain documentation

Operational guides live in `docs/`. OpenWiki owns maintained system explanations and native Claims.
The [documentation procedure](../documentation.md) owns coverage, links, source review, and fingerprints.
The [glossary](../GLOSSARY.md) owns canonical terms.
The [engineering practice](../engineering-excellence.md) connects source changes to executable evidence.
Keep the JSON report from the prose assessment.
`ASSESSED` reports measurement, without proof of comprehension or factual accuracy.

`docs/site.json` maps canonical documents into the Mintlify site.
Run `npm run docs:sync` after a mapped change.
Keep broad developer guides in the main navigation.
Keep focused runbooks and system explanations in the hidden reference group for direct links.
The [site runbook](../mintlify.md) defines projection gates and live-content evidence.

## Deliver changes

`tools/` owns setup, command installation, projection, packaging, and release coordination.
Inspect the owning command and focused tests before a tooling change.
Keep installed copies and temporary output outside authored source.

`package.json` owns the shared product version.
Release Please proposes synchronized version changes.
Harness publication and immutable release publication remain separate operations.
The [release runbook](../releases.md) defines their receipts and authorization.
The [portable instruction runbook](../global-agents.md) defines source snapshots and digest refresh.
Use [personal setup](../personal-setup.md) to find the installed owner before a configuration change.
