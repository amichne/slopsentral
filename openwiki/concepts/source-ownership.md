---
type: concept
title: Source ownership and plugin composition
description: How canonical primitives compose into plugins and profiles without transferring ownership to generated packages or installed caches.
tags: [ownership, composition, marketplace, resources]
sources:
  - id: openwiki-source-38f77ed28e29446493d61df3
    resource: repo://source/AGENTS.md
  - id: openwiki-source-d20a5dcde2278d9cc2bc00c4
    resource: repo://source/ARCHITECTURE.md
  - id: openwiki-source-817f5a68830289f58734f532
    resource: repo://source/plugins/repository-knowledge/plugin.json
generated: { by: "amp", at: "2026-10-26T01:58:25.745Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-10-26T01:58:25.745Z
---

# Source ownership and plugin composition

Edit the primitive that owns the behavior. A plugin selects primitives; it
does not become their source owner when it packages them.

## The authored graph

`source/adaptable.marketplace.json` declares canonical identities.
`source/plugins/*/plugin.json` selects skills, agents, hooks, instructions,
and resources by reference. Keep each primitive independently useful in its
canonical root, then compose it into the bundles that need it.

The source graph rejects conflicting identities, missing paths, dependency
cycles, and duplicate hook selection in a profile. `tools/catalog.mjs` resolves
dependencies and renders the catalog. A profile may share skills, agents, and
instructions across plugins, but must select each hook through one plugin in
its dependency closure. This packaging rule does not prove that a host executes
the hook once.

## Pick the procedure owner

| Bundle | Responsibility |
| --- | --- |
| Software Engineering | Shared engineering invariants, proof, scoped execution, Python, Git, and CI. |
| Kotlin Engineering | Kotlin implementation, review, compiler proof, and Gradle. |
| IntelliJ Plugin Development | Plugin delivery, PSI and indexing, platform tests, and live diagnostics. |
| Developer Tooling | CLI tools, agent resources, schemas, OpenAPI, Pkl, and personal configuration. |
| Repository Knowledge | Source-backed knowledge, technical documentation, glossaries, and navigation. |

Software Engineering is the default bundle. Selecting another procedure or
plugin does not grant authority to publish, deploy, or change unrelated files.

Repository Knowledge composes four procedures: `code-knowledge-base`,
`local-repository-navigation`, `controlled-technical-writing`, and
`technical-documentation`. Its bounded knowledge hooks do not authorize
automatic knowledge generation during ordinary code work. Start a documentation
rewrite only when the requested task calls for it.

## Reuse a file without importing its workflow

A `RESOURCE` references one executable or data file. It cannot reference a
directory, symlink, skill entry point, or destination alias. Its dependencies
may contain only resources. This lets a runtime consumer use an asset without
installing the full authoring procedure. See the
[resource contract](../../docs/workflow-resources.md) for manifest examples.

## From composition to consumers

The [projector](../architecture/projection.md) freezes validated source and maps
it into provider-specific packages. Generated provider trees and installed
caches remain consumers. Fix a wrong package in its primitive or provider
mapping, then generate a fresh tree; do not patch the consumer copy.

Follow the [authoring workflow](../workflows/authoring.md) to validate a change.
For documentation and glossary ownership, use the
[documentation workflow](../workflows/documentation.md). Keep canonical terms
aligned with the existing [glossary](../../docs/GLOSSARY.md).
