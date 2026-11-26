---
type: Runtime Flow
title: Source-bound provider projection
description: Follow frozen authored bytes through Pkl evaluation, sealed payload digests, and publication that never replaces a destination.
tags: [projection, pkl, provenance, providers]
verified:
  - by: openwiki/0.6.1
    at: 2026-11-25T23:51:07.810Z
sources:
  - id: openwiki-source-2a773b8dcd244b49fcf7a60f
    resource: repo://docs/pkl-projection.md
  - id: openwiki-source-807a6d12541ccce1af9c76cb
    resource: repo://tools/project_marketplaces.py
  - id: openwiki-source-fc855c6faec3d10981287a01
    resource: repo://tools/projection/Amp.pkl
  - id: openwiki-source-e6b983bb7d255d730352ff15
    resource: repo://tools/projection/materialize.py
  - id: openwiki-source-20306a8272518c1714fe0273
    resource: repo://tools/projection/Pi.pkl
  - id: openwiki-source-24c2e5fb15011b196a066fdc
    resource: repo://tools/projection/Project.pkl
  - id: openwiki-source-394daa51fe52aaa0810ba746
    resource: repo://tools/projection/publish_directory.py
  - id: openwiki-source-29b8d13ca4d0c5f112b0bb17
    resource: repo://tools/tests/pkl-projection.test.mjs
  - id: openwiki-source-1c86dc4352b4d3810fb862e2
    resource: repo://tools/toolchain.json
  - id: openwiki-source-8e19a201713737e2b24afa79
    resource: repo://tools/toolchain.py
generated: { by: "codex", at: "2026-11-25T23:51:07.810Z" }
---

# Source-bound provider projection

The projector turns one accepted authored graph into a complete provider tree.
Pkl defines provider manifests and copy plans. Python runs the evaluator, copies frozen assets, hashes the output, and publishes the staged tree.

## Freeze, evaluate, seal, publish

The [entry point](../../tools/project_marketplaces.py) reads regular source files once and keeps their bytes and Unix modes.
It rejects source symlinks and nonregular resources.
It also captures local evidence outside `source/` when current routing cases cite those files.
Graph and catalog checks run against a temporary copy of those same inputs.

Pkl receives the frozen model through a temporary JSON file.
Evaluation uses isolated module copies, explicit module and resource allowlists, and a bounded timeout.
Exactly Pkl 0.32.0 is accepted.
A missing runtime, wrong version, rejected model, or malformed plan stops the operation.

The first evaluation derives output operations.
The second evaluation seals the digests of actual derived payloads.
The projector rejects changed derived bytes, changed modes, incomplete plugin coverage, and mismatched reference digests.
It reexamines source and routing evidence before publication.
A concurrent input change produces `INPUT_CHANGED`.

The complete tree enters a staging directory beside the requested destination.
The [native publisher](../../tools/projection/publish_directory.py) uses a no-replace directory operation.
An existing destination, a destination inside the source repository, or unavailable atomic publication stops the operation.
The projector does not download a runtime or replace a previous tree.

## Provider capability limits

| Provider | Native projection | Limit |
| --- | --- | --- |
| Codex | Marketplace, plugins, skills, declared adapters, and provenance | Host trust and live consumption remain host obligations |
| GitHub Copilot | Marketplace and projected plugin payloads | Provider packaging differs from Codex |
| Claude Code | Native marketplace, plugin bundles, skills, Markdown agents, and the software engineering SessionStart hook | Other hook adapters remain reference files |
| Amp | Complete directory plugins, native skills, and `agent.start` instructions | Hooks, agents, and MCP stay reference-only. Profiles are unsupported |
| Pi | Aggregate and per-plugin packages, native skills and prompts, and hook adapters | Workflow profiles are unsupported. MCP needs an explicit adapter |

Amp adds interpreter guidance to a successful skill load when the skill bundles
scripts. The package keeps the canonical skill bytes.
The turn-start event carries the plugin's canonical instructions.

The [Pi model](../../tools/projection/Pi.pkl) projects every accepted catalog plugin.
It needs one shared version and unique hook owners.
The aggregate deduplicates shared skill registrations by name.
Its inventory binds every payload file to a digest.
The retired single-skill Pi package does not describe current projection.

## Generate a provider tree

[The toolchain manifest](../../tools/toolchain.json) pins Pkl 0.32.0 for each platform by digest.
`python3 tools/toolchain.py fetch` downloads and verifies it as an explicit setup step, and
`python3 tools/toolchain.py run --` supplies it to a command through `PKL_BIN`.
The projector itself never downloads a runtime.
Use a fresh output path for each provider:

```sh
python3 tools/toolchain.py fetch pkl
export PKL_BIN="$(python3 tools/toolchain.py path pkl)"
python3 tools/project_marketplaces.py --source . --harness codex --out /tmp/slopsentral-codex-new
python3 tools/project_marketplaces.py --source . --harness github-copilot --out /tmp/slopsentral-copilot-new
python3 tools/project_marketplaces.py --source . --harness amp --out /tmp/slopsentral-amp-new
python3 tools/project_marketplaces.py --source . --harness claude --out /tmp/slopsentral-claude-new
python3 tools/project_marketplaces.py --source . --harness pi --out /tmp/slopsentral-pi-new
```

The [projection guide](../../docs/pkl-projection.md) explains installation and provider-specific recovery.
[Focused tests](../../tools/tests/pkl-projection.test.mjs) exercise accepted source and rejection paths.
Projection proves package construction. [Hook delivery](hooks.md), [consumer installation](../integrations/installation.md), and [release publication](../operations/releases.md) need separate evidence.
