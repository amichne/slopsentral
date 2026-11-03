---
type: Engineering Practice
title: Evidence and knowledge freshness
description: Connect a system claim to its source owner, executable oracle, related concepts, and explicit freshness limits.
tags: [evidence, okf, claims, freshness, engineering]
verified:
  - by: openwiki/0.6.1
    at: 2026-11-03T20:23:45.331Z
sources:
  - id: openwiki-source-e14c3521bbc2e703193cadf9
    resource: repo://source/instructions/engineering-design.md
  - id: openwiki-source-fce7a6054d61269783034ac4
    resource: repo://source/skills/code-knowledge-base/scripts/documentation.py
generated: { by: "codex", at: "2026-11-03T20:23:45.331Z" }
---

# Evidence and knowledge freshness

A system explanation helps a reader predict behavior and choose a safe change.
Its material claims need source evidence, useful neighbors, and a repeatable way to detect drift.
A recent date does not establish that the explanation remains true.

## Keep facts and obligations distinct

The [engineering baseline](../../source/instructions/engineering-design.md) starts from the consumer, invariant, owner, legal states, and decisive check.
Source code and authoritative contracts establish current behavior.
A plan describes intended behavior. A historical audit describes its recorded revision and environment.
An unresolved gap remains explicit until the named mechanism supplies evidence.

An executable oracle exercises the actual obligation with an accepted case and a nearby rejection case.
Compiler acceptance proves an encoded type constraint.
Schema acceptance proves a serialized shape.
A process result, native host interaction, and live model response establish different facts.
Do not substitute a neighboring passing gate for the mechanism in the claim.

## Use one knowledge owner

`openwiki/` owns this repository's OKF explanations.
Each concept has a stable path, a nonempty `type`, and useful links to neighboring concepts or workflows.
The body explains behavior, ownership, failure, and consequences.
It does not become a second copy of the implementation.

OpenWiki owns Claim identities and versioned evidence.
A material Claim states one independently falsifiable truth and cites repository resources.
A stale or unresolved Claim needs source review.
Keep the same Claim identity when the proposition remains the same.
Retract a Claim only when the final page no longer asserts it.

The [native lifecycle](../workflows/documentation.md) owns page assignment, sidecars, provenance, indexes, and finalization.
The standalone OKF validator cannot replace that lifecycle.
The [repository glossary](../../docs/GLOSSARY.md) keeps established terms consistent without another glossary under the wiki.

## Detect change without claiming semantic proof

The repository's [documentation contract](../../docs/documentation.md) links functional areas to source owners and explanations.
`slopsentral-docs check` compares the reviewed source and page bytes with the committed receipt.
It rejects missing coverage, broken local links or anchors, invalid OKF pages, missing Claims, and incomplete native runs.

A source change invalidates the old byte agreement even when the explanation remains accurate.
Review the affected claim before recording another receipt.
A no-change page decision needs a source-backed reason in the PR description or an existing task review receipt.
The receipt records reviewed bytes. It does not prove claim completeness or semantic correctness.

## Use the same portable mechanism

The [distributed runtime](../../source/skills/code-knowledge-base/scripts/documentation.py) owns coverage, links, admission prerequisites, and reviewed fingerprints.
Slopsentral invokes that runtime through `bin/slopsentral-docs`.
The Code Knowledge Base package ships its script, adjacent lock, schema, adoption procedure, and independent-project template.
Project policy stays in the coverage configuration.

A project selects its source roots, document roots, entrypoints, and fingerprint exceptions.
A standalone OKF store needs no OpenWiki checkpoint or Claim sidecars.
An OpenWiki store keeps its native lifecycle and completion prerequisites.
The [portable procedure](../../source/skills/code-knowledge-base/references/portable-documentation.md) explains adoption without a Slopsentral checkout.

## Keep the practice proportional

Retrieve only the knowledge that answers the current question.
An ordinary code task can maintain an existing affected explanation within its authorized scope.
It does not authorize a new knowledge store or a repository-wide generation run.
A broad rewrite needs its own requested scope and coverage plan.
Use [authoring](../workflows/authoring.md) to connect a source change to focused proof and affected documentation.
