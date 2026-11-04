---
type: Guide
title: Slopsentral quickstart
description: Select an engineering procedure, install a consumer, or change the source with linked documentation and executable evidence.
tags:
  - quickstart
  - navigation
  - engineering
  - okf
verified:
  - by: openwiki/0.6.1
    at: 2026-11-04T15:10:06.076Z
sources:
  - id: openwiki-source-6d4b4e707b8d60b6ccfa3425
    resource: repo://.github/workflows/openwiki-update.yml
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-38f77ed28e29446493d61df3
    resource: repo://source/AGENTS.md
  - id: openwiki-source-59e94a76c36256a0ceee4f2d
    resource: repo://source/hooks/pi/adapter.ts
  - id: openwiki-source-1b7d2f4ea3c52b3ee1894e61
    resource: repo://source/instructions/agent-execution.md
  - id: openwiki-source-965e21463a3abc211c0d505e
    resource: repo://tools/install-pi.sh
  - id: openwiki-source-b796202ab127e6e56e465638
    resource: repo://tools/python_checks/gates.py
  - id: openwiki-source-755a3cefcf633172d98cf969
    resource: repo://tools/setup-pi.mts
  - id: openwiki-source-6706911967b481bbbe3dfbe8
    resource: repo://tools/setup.py
generated: { by: "codex", at: "2026-11-04T15:10:06.076Z" }
---

# Slopsentral quickstart

Slopsentral composes source-owned engineering procedures by reference into five installable plugins.
Generated provider packages and installed caches remain consumers.
Software Engineering supplies the shared practice. Add a specialty when the task needs its tools or contracts.
A plugin installation grants no authority to publish, deploy, or change personal configuration.

## Choose the task

| Task | Explanation | Operational guide |
| --- | --- | --- |
| Understand owners and composition | [Source ownership](concepts/source-ownership.md) | [Architecture](../source/ARCHITECTURE.md) |
| Install or update a host plugin | [Command lifecycle](integrations/cli.md) | [Command guide](../docs/cli-install.md) |
| Install or recover Pi | [Consumer installation](integrations/installation.md) | [Pi guide](../docs/pi-install.md) |
| Prepare a source change | [Authoring](workflows/authoring.md) | [Documentation practice](../docs/documentation.md) |
| Produce a provider package | [Projection](architecture/projection.md) | [Projection guide](../docs/pkl-projection.md) |
| Understand hook delivery | [Hook lifecycle](architecture/hooks.md) | [Scoped instructions](../docs/agents-md-scope.md) |
| Select a Codex profile | [Profiles](integrations/profiles.md) | [Profile guide](../docs/profile-lifecycle.md) |
| Install portable instructions | [Global instructions](integrations/global-instructions.md) | [Source map](../docs/global-agents.md) |
| Examine a release or failed publication | [Release lifecycle](operations/releases.md) | [Release guide](../docs/releases.md) |
| Distinguish fixtures from live evidence | [Evaluations](operations/evaluations.md) | [Evaluation guide](../docs/skill-evals.md) |
| Adopt this practice in another project | [Portable documentation](workflows/documentation.md#adopt-the-same-practice-in-another-project) | [Packaged procedure](../source/skills/code-knowledge-base/references/portable-documentation.md) |
| Review stale knowledge | [Evidence model](concepts/evidence.md) | [Documentation workflow](workflows/documentation.md) |
| Select the decisive gate | [Validation](testing/validation.md) | [Guide index](../docs/index.md) |

## Prepare a maintainer checkout

Install the tools declared by `mise.toml`.
From the repository root, use the public checkout commands:

```sh
mise install
mise exec -- slopsentral-setup
mise exec -- slopsentral-check
mise exec -- slopsentral-docs check
```

Setup synchronizes locked Python and Node dependencies.
The Python gate runs Ruff, strict Pyright, and pytest within the declared scope.
Projection also needs exactly Pkl 0.32.0 and a fresh output directory.
Use the explicit [runtime setup procedure](architecture/projection.md#generate-a-provider-tree).

Consumers use qualified release assets instead of the maintainer toolchain.
The general command uses uv and Python.
The separate Pi launcher needs neither system Python nor uv: setup downloads and verifies a private hook interpreter before activating configuration.
Managed hooks then run without system Python or uv and need no network access.
Personal home storage owns runtime authority for project installations, too.
Direct native package installation bypasses that provisioning; the [Pi guide](../docs/pi-install.md) explains its external runtime requirement.

## Read and change knowledge with the source

Use the [catalog](../source/CATALOG.md) for exact plugin identities and composition.
Use the [glossary](../docs/GLOSSARY.md) for established terms.
Retrieve the smallest explanation that answers the current question, then examine its source before a material decision.

These OKF pages preserve Claims and source evidence through OpenWiki.
The repository gate links functional areas to explanations and compares reviewed source bytes.
Neither a fresh digest nor valid Markdown proves factual accuracy, host consumption, or model compliance.
Slopsentral uses the same distributed documentation runtime that the portable procedure supplies to other projects.
The package assertions exercise that runtime in independent projects through all four provider projections.
Historical audits keep their original evidence scope in the [guide index](../docs/index.md).

Documentation automation proposes generated wiki changes for review.
It does not auto-merge or publish executable source changes.
