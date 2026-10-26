---
type: workflow
title: Author and validate a change
description: Select a canonical edit surface, run checks suited to its contract, and separate static acceptance, model decisions, and actual host behavior.
tags: [authoring, validation, testing, evidence]
verified:
  - by: openwiki/0.6.1
    at: 2026-10-26T01:49:39.323Z
sources:
  - id: openwiki-source-29733941fb1d8a282d0caafb
    resource: repo://.github/workflows/validate-source.yml
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-66c6b4ed1002f7045a480f19
    resource: repo://tools/check.py
  - id: openwiki-source-f0a86d14d800938edb2bf80a
    resource: repo://tools/promptfoo/suite.mts
  - id: openwiki-source-6706911967b481bbbe3dfbe8
    resource: repo://tools/setup.py
generated: { by: "amp", at: "2026-10-26T01:49:39.323Z" }
---

# Author and validate a change

Start at the [source owner](../concepts/source-ownership.md). Change the primitive,
composition manifest, or projector mapping responsible for the requested
behavior. Generated provider trees and installed caches are not edit surfaces.

## Prepare the checkout explicitly

Install uv 0.12.9 or later and a Node version accepted by `package.json`, then:

```sh
uv run --locked tools/setup.py
```

Setup synchronizes locked Python dependencies, including the refactor group,
and runs `npm ci --ignore-scripts`. It does not silently install uv.
For projection, install Pkl 0.32.0 through the checksum-verified boundary:

```sh
node tools/install-projection-pkl.mjs --out /tmp/slopsentral-pkl-new/pkl
```

## Match the check to the changed contract

| Changed surface | Checks |
| --- | --- |
| Composition or marketplace | Source graph, catalog freshness, and fresh provider projections. |
| Python automation | `uv run --locked tools/check.py` plus focused behavior checks. |
| Shared product versions or release behavior | `npm run check:release` and the actual Release Please updater test. |
| Pi installer or release | Type checks, native Pi tests, and focused Python Pi checks. |
| Skill decision cases | Offline controls, then fresh live model responses. |
| Documentation | Source claims, links, glossary, and the selected backend's native lifecycle. |

After a composition edit, regenerate the catalog with
`node tools/catalog.mjs --write`, then use fresh output paths:

```sh
node tools/validate-source-graph.mjs
node tools/catalog.mjs --check
PKL_BIN=/tmp/slopsentral-pkl-new/pkl node tools/project-marketplaces.mjs --source . --harness codex --out /tmp/slopsentral-codex-new
PKL_BIN=/tmp/slopsentral-pkl-new/pkl node tools/project-marketplaces.mjs --source . --harness github-copilot --out /tmp/slopsentral-copilot-new
PKL_BIN=/tmp/slopsentral-pkl-new/pkl node tools/project-marketplaces.mjs --source . --harness amp --out /tmp/slopsentral-amp-new
git diff --check
```

The [projection runbook](../../docs/pkl-projection.md) explains isolation,
provenance, and provider-specific checks. Projection never replaces an existing
output. `tools/check.py` stops on the first failed or unavailable stage;
`pyproject.toml` defines strict static-analysis coverage, not a claim that every
legacy Python helper meets the same coverage.

After changing a portable snapshot asset, review and refresh its
[manifest](../integrations/global-instructions.md). Keep installed snapshots
outside authored edits.

## Keep evidence classes separate

`source/evals/promptfoo/cases.mts` owns decision cases and expected answers.
Extend it rather than creating another decision catalog. `npm run check:evals`
runs type checks and offline controls. `npm run eval:skills` obtains fresh
responses with supplied skill text and a paired no-skill control. The suite
records skill, reference, prompt, and grader hashes; it disables tool use in
these decision tasks. These responses do not prove automatic skill routing or
real tool execution.

Plugin execution scenarios use `npm run eval:execution` and an explicit ignored
fixture registry. Missing fixtures are nonpassing `BLOCKED_SETUP`, not synthetic
model scores. See the [eval guide](../../docs/skill-evals.md) for evidence limits.

`Validate Source` runs offline controls without paid model calls. It also checks
native packages and retains source-bound artifacts for
[release admission](../operations/releases.md). Local passing checks do not
establish a successful Actions run, release, host discovery, or model compliance.

For OKF pages and missing-glossary handling, follow the
[documentation workflow](documentation.md). End each change with the checks
that actually ran and the obligations that remain unverified.
