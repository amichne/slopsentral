---
type: Runtime Flow
title: Source-bound provider projection
description: Follow frozen authored bytes through Pkl evaluation, sealed payload digests, and publication that never replaces a destination.
tags: [projection, pkl, provenance, providers]
verified:
  - by: openwiki/0.6.1
    at: 2026-11-03T17:57:45.987Z
sources:
  - id: openwiki-source-0de19b70b13c7683e196f562
    resource: repo://tools/project-marketplaces.mjs
  - id: openwiki-source-fc855c6faec3d10981287a01
    resource: repo://tools/projection/Amp.pkl
  - id: openwiki-source-20306a8272518c1714fe0273
    resource: repo://tools/projection/Pi.pkl
  - id: openwiki-source-394daa51fe52aaa0810ba746
    resource: repo://tools/projection/publish_directory.py
generated: { by: "codex", at: "2026-11-03T17:57:45.987Z" }
---

# Source-bound provider projection

The projector turns one accepted authored graph into a complete provider tree.
JavaScript owns file and process effects. Pkl owns provider-specific shapes and text transformations.

## Freeze, evaluate, seal, publish

The [entry point](../../tools/project-marketplaces.mjs) reads regular source files once and keeps their bytes and Unix modes.
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
| Amp | Complete directory plugins, native skills, and `agent.start` instructions | Hooks, agents, and MCP stay reference-only. Profiles are unsupported |
| Pi | Aggregate and per-plugin packages, native skills and prompts, and hook adapters | Workflow profiles are unsupported. MCP needs an explicit adapter |

The [Pi model](../../tools/projection/Pi.pkl) projects every accepted catalog plugin.
It needs one shared version and unique hook owners.
The aggregate deduplicates shared skill registrations by name.
Its inventory binds every payload file to a digest.
The retired single-skill Pi package does not describe current projection.

## Generate a provider tree

From a prepared checkout, install the pinned runtime explicitly:

```sh
node tools/install-projection-pkl.mjs --out /tmp/slopsentral-pkl-new/pkl
```

Set `PKL_BIN` to that executable.
Use a fresh output path for each provider:

```sh
node tools/project-marketplaces.mjs --source . --harness codex --out /tmp/slopsentral-codex-new
node tools/project-marketplaces.mjs --source . --harness github-copilot --out /tmp/slopsentral-copilot-new
node tools/project-marketplaces.mjs --source . --harness amp --out /tmp/slopsentral-amp-new
```

The [projection guide](../../docs/pkl-projection.md) explains installation and provider-specific recovery.
[Focused tests](../../tools/tests/pkl-projection.test.mjs) exercise accepted source and rejection paths.
Projection proves package construction. [Hook delivery](hooks.md), [consumer installation](../integrations/installation.md), and [release publication](../operations/releases.md) need separate evidence.
