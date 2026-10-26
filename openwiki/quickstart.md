---
type: guide
title: Slopsentral quickstart
description: Choose a plugin or consumer installation, prepare a maintainer checkout, and find source-backed authoring, projection, release, and documentation procedures.
tags: [quickstart, navigation, plugins, maintenance]
sources:
  - id: openwiki-source-6d4b4e707b8d60b6ccfa3425
    resource: repo://.github/workflows/openwiki-update.yml
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-a36608fe0211a909095a55f8
    resource: repo://docs/pi-install.md
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-66c6b4ed1002f7045a480f19
    resource: repo://tools/check.py
  - id: openwiki-source-6706911967b481bbbe3dfbe8
    resource: repo://tools/setup.py
generated: { by: "amp", at: "2026-10-26T01:58:25.745Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-10-26T11:32:19.597Z
---

# Slopsentral quickstart

Slopsentral composes canonical engineering procedures into installable plugins.
Start with the task you need to complete. Consumer installation does not require
the full maintainer toolchain, and selecting a skill does not grant authority
to publish, deploy, or change personal configuration.

## Find the right workflow

| Reader action | Start here |
| --- | --- |
| Choose a plugin or understand primitive ownership | [Source ownership and composition](concepts/source-ownership.md) |
| Install, update, or recover a Pi or Amp consumer | [Consumer installation](integrations/installation.md) |
| Install portable engineering instructions and local references | [Global instructions](integrations/global-instructions.md) |
| Change source and choose focused validation | [Authoring](workflows/authoring.md) |
| Generate a provider package or inspect capability limits | [Projection](architecture/projection.md) |
| Understand version proposals and tested-byte publication | [Releases](operations/releases.md) |
| Rewrite pages, manage glossary gaps, or configure docs updates | [Documentation](workflows/documentation.md) |

## Choose a plugin for the task

Software Engineering supplies the shared engineering procedures. Add Kotlin
Engineering for Kotlin work, then a specialty only when the requested task
needs it. IntelliJ Plugin Development covers IDE integrations; Developer
Tooling covers CLIs and configuration contracts; Repository Knowledge covers
documentation, glossaries, and source-backed knowledge.

The [canonical catalog](../source/CATALOG.md) gives exact identifiers and
composition. Plugins reference primitives rather than owning copies. Generated
provider packages and installed caches remain consumers, not source authorities.

## Prepare a maintainer checkout

Use a Node version accepted by `package.json` and uv 0.12.9 or later. From the
checkout root:

```sh
uv run --locked tools/setup.py
uv run --locked tools/check.py
```

Setup synchronizes locked dependencies. The Python gate runs formatting,
linting, strict type checks in the declared scope, and tests. Projection also
requires Pkl 0.32.0 through the explicit
[runtime installation boundary](architecture/projection.md#generate-a-provider-tree).
Use fresh output directories. See [authoring](workflows/authoring.md) for the
smallest check set and the other gates for each changed surface.

For consumers, start at [installation](integrations/installation.md) instead.
Pi setup downloads verified release bytes without Python, uv, Pkl, or an npm
installation. Amp uses complete selected bundles and native discovery checks.

## Read knowledge as evidence, not authority

These OKF pages describe current behavior with OpenWiki-managed Claims and
repository citations. Source code, schemas, and tests remain authoritative.
Use the existing [glossary](../docs/GLOSSARY.md) for stable domain meanings.
A successful graph check or projection is not evidence that a host loads a
plugin, a model follows instructions, or a release has been published.

Existing `docs/` pages remain supporting runbooks. Start with
[projection details](../docs/pkl-projection.md),
[Pi setup and recovery](../docs/pi-install.md),
[release credentials and recovery](../docs/releases.md), and
[skill eval evidence](../docs/skill-evals.md) when you need their operational
detail. Historical audits keep their original scope and are not current
measurements. Recurring documentation changes are proposed for review; they
do not authorize executable source edits or automatic merging.
