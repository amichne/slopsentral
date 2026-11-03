---
type: Architecture
title: Source ownership and plugin composition
description: Canonical primitives compose into plugins and profiles while generated provider packages remain consumers.
tags: [ownership, composition, marketplace, resources]
verified:
  - by: openwiki/0.6.1
    at: 2026-11-03T17:57:45.987Z
sources:
  - id: openwiki-source-38f77ed28e29446493d61df3
    resource: repo://source/AGENTS.md
  - id: openwiki-source-817f5a68830289f58734f532
    resource: repo://source/plugins/repository-knowledge/plugin.json
  - id: openwiki-source-0de19b70b13c7683e196f562
    resource: repo://tools/project-marketplaces.mjs
generated: { by: "codex", at: "2026-11-03T17:57:45.987Z" }
---

# Source ownership and plugin composition

Each invariant and procedure has one authored owner.
A plugin selects that owner by reference. It does not own another copy of the procedure.

## From primitive to consumer

`source/adaptable.marketplace.json` declares the marketplace identities.
`source/plugins/*/plugin.json` composes skills, agents, hooks, instructions, and resources.
Profiles select those compositions for a task without implicit installation.
The [catalog](../../source/CATALOG.md) exposes the resolved identities and references.

The [source graph gate](../../tools/validate-source-graph.mjs) examines the declared paths and schemas before projection.
It rejects conflicting identities, missing paths, dependency cycles, and duplicate hook selection within a profile.
A profile can share skills and instructions across plugins. Its dependency closure selects each hook through one plugin.
That packaging rule does not prove one invocation in a live host.

The [projector](../architecture/projection.md) consumes the accepted graph and freezes its authored bytes.
Pkl owns provider shapes. Generated trees and installed caches remain consumers.
A repair belongs in the primitive or projector that owns the behavior, followed by regeneration.

## Select the procedure owner

| Plugin | Responsibility |
| --- | --- |
| Software Engineering | Shared invariants, proof, Python automation, Git, PRs, and CI |
| Kotlin Engineering | Kotlin implementation, review, compiler proof, application libraries, and Gradle |
| IntelliJ Plugin Development | Plugin delivery, PSI, indexing, platform tests, and live diagnostics |
| Developer Tooling | CLIs, agent resources, schemas, OpenAPI, Pkl, and personal configuration |
| Repository Knowledge | Source-backed explanations, navigation, technical documents, and prose assessment |

Software Engineering remains the default.
Knowledge maintenance forms part of its engineering baseline, while Repository Knowledge supplies the specialized procedures.
Repository Knowledge composes `code-knowledge-base`, `local-repository-navigation`, `technical-documentation`, and `controlled-technical-writing`.
Selecting the latter does not authorize automatic knowledge generation during an ordinary code task.
Read [evidence and freshness](evidence.md) before a claim that a page is current.

## Reuse one executable without its workflow

A `RESOURCE` names one regular executable or data file.
It excludes directories, symlinks, destination aliases, and `SKILL.md` entry points.
Its dependencies can select only resources.

This variant lets a hook consume a runtime helper without installing the helper's entire authoring procedure.
The source identity, bytes, mode, and digest remain part of the graph.
Use the [resource guide](../../docs/workflow-resources.md) for declaration examples and focused checks.

## Change an owner safely

Find the primitive and its direct consumers before a change.
Keep task-specific detail in the skill's local references.
Change its composition only when the consumer needs another capability.
Then examine the graph, catalog, fresh projections, and affected knowledge together.
The [authoring workflow](../workflows/authoring.md) selects the necessary gates.
