# Contribute and maintain

Change canonical source, run the gates for that surface, and regenerate affected consumers.
[Key aspects of the codebase](../codebase.md) maps the owners.

## Prepare a checkout

Install Python 3, Node.js, and npm. The Python bootstrap reads [the toolchain manifest](../../tools/toolchain.json),
which pins uv, Pkl, and Vale to exact versions and SHA-256 digests.
Prepare the checkout:

```sh
python3 tools/toolchain.py run -- slopsentral-setup
```

`python3 tools/toolchain.py run -- COMMAND` downloads and verifies the pinned tools into
`~/.cache/slopsentral/toolchain`, then runs the command with those tools and `bin/` first
on `PATH`. It sets `PKL_BIN` and `VALE_BIN` unless you set them yourself, and changes
nothing outside the child process. CI uses the manifest’s exact uv version.
Checkout commands accept uv 0.12.9 or later for locked script execution.
For the command from source, run:

```sh
python3 tools/toolchain.py run -- uv run --locked --script tools/slopsentral.py self install
```

The [Worktrunk runbook](../worktrunk-automation.md) describes hooks for CLI-owned worktrees.
Host-managed worktrees keep their host lifecycle.

## Choose the smallest gate

| Changed surface | Gate |
| --- | --- |
| Python automation | `python3 tools/toolchain.py run -- slopsentral-check` |
| Marketplace or plugin composition | Graph and fresh provider projections in [plugins and profiles](composition.md#admission-and-projection) |
| Pi installer or release | `npm run check:pi`, Pi Node tests, and focused Python Pi tests |
| Unified releases | `npm run check:release` and `node --test tools/tests/release-please.test.mjs` |
| Evaluations | `npm run check:evals` |
| Prose | `python3 tools/toolchain.py run -- slopsentral-prose changed` |
| Documentation | `bin/slopsentral-docs check` and `bin/slopsentral-ci docs` |

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
