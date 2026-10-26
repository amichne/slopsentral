---
type: architecture
title: Projection and provider boundaries
description: How authored primitives become provider packages through frozen inputs, typed Pkl plans, sealed digests, and no-replace publication.
tags: [projection, pkl, ownership, providers]
verified:
  - by: openwiki/0.6.1
    at: 2026-10-26T01:58:25.745Z
sources:
  - id: openwiki-source-0de19b70b13c7683e196f562
    resource: repo://tools/project-marketplaces.mjs
  - id: openwiki-source-fc855c6faec3d10981287a01
    resource: repo://tools/projection/Amp.pkl
  - id: openwiki-source-20306a8272518c1714fe0273
    resource: repo://tools/projection/Pi.pkl
  - id: openwiki-source-394daa51fe52aaa0810ba746
    resource: repo://tools/projection/publish_directory.py
generated: { by: "amp", at: "2026-10-26T01:58:25.745Z" }
---

# Projection and provider boundaries

Use the projector to build a fresh provider tree. Change authored primitives
or Pkl mappings when output is wrong; generated trees are not source owners.

## From source to published directory

`tools/project-marketplaces.mjs` coordinates the boundary. It freezes regular
source files, including their bytes and modes, and rejects symbolic links.
The source graph resolves which primitives belong to each plugin.

`Decode.pkl` refines the input into `Schema.pkl` types. `Project.pkl` selects
the provider mapping and produces a file plan. Node evaluates the plan with
exactly Pkl 0.32.0 in an isolated directory. The evaluator cannot read ambient
environment variables or fetch remote modules through its configured allowlists.

The first evaluation derives payloads. Node hashes those payloads and evaluates
again to seal provenance. It rejects sealing that changes derived bytes or
records a digest different from its payload. Before writing, it checks that
the authored source and referenced current evidence still match the snapshot.

Publication stages the complete tree beside its destination. A native
no-replace rename admits it only if the destination is vacant. An existing
output returns `OUTPUT_EXISTS`; unsupported atomic publication fails closed.
There is no replacing fallback.

## Generate a provider tree

Install the runtime explicitly; projection does not download it:

```sh
node tools/install-projection-pkl.mjs --out /tmp/slopsentral-pkl-new/pkl
PKL_BIN=/tmp/slopsentral-pkl-new/pkl node tools/project-marketplaces.mjs --source . --harness amp --out /tmp/slopsentral-amp-new
```

Use a fresh output outside the source repository. Its parent must exist.
Select `codex`, `github-copilot`, `amp`, or the constrained `pi` target.
The [projection runbook](../../docs/pkl-projection.md) has the complete command
set, provenance details, and compatibility evidence.

## Provider capabilities differ

| Target | Output root | Important boundary |
| --- | --- | --- |
| Codex | `.agents/plugins` | Uses the Codex provider mapping. |
| GitHub Copilot | `.github/plugin` | Uses the Copilot provider mapping. |
| Amp | `.amp/plugins` | Registers skills and supplies instructions through `agent.start`. |
| Pi | `.pi/slopsentral` | Contains only the canonical `semantic-ratchet` native default. |

Amp records hooks, agents, and MCP configuration as reference-only material.
It does not run them or support workflow profiles. Its complete bundle
includes scripts and references, not merely `index.js`.

Pi rejects arbitrary plugin selections. It does not emulate hooks, instruction
policy, commands, extensions, or workflow profiles.

## What the checks establish

Projection acceptance establishes a generated package and its recorded hashes.
It does not establish host discovery, hook delivery, or model compliance.
Use [authoring checks](../workflows/authoring.md) for evidence appropriate to the
changed surface and [installation guidance](../integrations/installation.md)
for consumer verification. [Release publication](../operations/releases.md)
adds admission of tested artifacts; it is a separate operation.
