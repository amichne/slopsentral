---
type: Validation Strategy
title: Match checks to the engineering claim
description: Select the smallest faithful gate for source, contracts, packages, knowledge, host behavior, and live model outcomes.
tags: [validation, tests, evidence, contracts]
sources:
  - id: openwiki-source-fce7a6054d61269783034ac4
    resource: repo://source/skills/code-knowledge-base/scripts/documentation.py
  - id: openwiki-source-bc02d03ee1199b9d70e47f54
    resource: repo://source/skills/tdd/SKILL.md
  - id: openwiki-source-66c6b4ed1002f7045a480f19
    resource: repo://tools/check.py
  - id: openwiki-source-b796202ab127e6e56e465638
    resource: repo://tools/python_checks/gates.py
  - id: openwiki-source-2402abcd09d5c9c6105c476c
    resource: repo://tools/tests/documentation-portability.test.mjs
generated: { by: "codex", at: "2026-11-03T20:23:45.331Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-11-03T20:23:45.331Z
---

# Match checks to the engineering claim

A passing result supports the mechanism that the command actually exercises.
The [TDD procedure](../../source/skills/tdd/SKILL.md) connects each behavior change to an independent oracle and a nearby rejection case.
Run a wider gate only for repository policy, changed consumers, or a named unresolved concern.

## Select the edited surface

| Surface | Gate | What the result establishes |
| --- | --- | --- |
| Python automation | `mise exec -- slopsentral-check` | Ruff, strict Pyright within its include list, and selected pytest assertions |
| Source composition | `node tools/validate-source-graph.mjs` | Declared schemas, canonical identities, paths, and graph invariants |
| Catalog | `node tools/catalog.mjs --check` | Agreement between source composition and the generated catalog |
| Provider shape | Fresh `project-marketplaces.mjs` output | Native Pkl evaluation, accepted operations, sealed payloads, and no-replace output |
| Knowledge | `mise exec -- slopsentral-docs check` | Named coverage, local links, native completion prerequisites, and reviewed byte agreement |
| Changed prose | `mise exec -- slopsentral-prose changed` | Pinned local prose rules and glossary assessment |
| Offline evaluation controls | `npm run check:evals` | Types, deterministic controls, and adapter contracts without fresh model evidence |
| Unified version | `npm run check:release` | Synchronized authored product versions and release configuration |

Use the focused commands in [projection](../architecture/projection.md), [installation](../integrations/installation.md), [profiles](../integrations/profiles.md), and [releases](../operations/releases.md) for their contracts.
Their guides name the responsible fixtures and tests.

## Keep accepted and rejected cases independent

Derive expected results from the public contract, source invariant, or an independent verifier.
A fake cannot encode the desired conclusion.
A compiler misuse case must fail for the intended diagnostic.
A malformed fixture or unavailable compiler does not prove that the API rejects the illegal operation.

Keep the initial and final oracle identity stable.
That identity includes the working directory, command, input, assertions, and meaningful environment.
Zero selected assertions provide no behavior proof.
A process return code needs the native evidence that the intended assertion ran.

## Exercise the distributed practice independently

The [portable package tests](../../tools/tests/documentation-portability.test.mjs) project Codex, GitHub Copilot, Amp, and Pi packages through native Pkl.
They compare the shipped runtime, lock, schema, procedure, and template with their canonical bytes.
They then copy only shipped scripts into an isolated location.

A separate Git project uses `app/`, `handbook/`, `knowledge/`, and `.knowledge/`.
The runtime runs from an unrelated directory with explicit project, configuration, and lock paths.
The accepted path records reviewed inputs and reports `CURRENT`.
A source change reports `STALE` with the affected path.
Broken links, invalid OKF, missing configuration, and a missing dependency lock reject the operation.
The assertions also make sure that `check` preserves file bytes, modes, and Git status.

The [Python tests](../../tools/python_checks/test_documentation.py) also exercise the complete shipped template in another Git repository.
They reject a foreign lock symlink and a configuration that hides its declared knowledge pages.
These results establish portable package behavior, without model responses or native host registration.
The [adoption procedure](../../source/skills/code-knowledge-base/references/portable-documentation.md) uses the same runtime that Slopsentral invokes.

## Name the next system layer

A schema result cannot establish an external write.
A package result cannot establish native discovery or trust.
A mocked host cannot establish a live IDE interaction.
A routing fixture cannot establish a fresh model decision.
The [evaluation model](../operations/evaluations.md) keeps these evidence levels distinct.

For documentation, a valid link establishes that a destination exists.
A digest establishes agreement with selected bytes.
Neither establishes that a paragraph explains the source correctly.
Use [Claim review](../workflows/documentation.md) and source examination for that obligation.

## Preserve the result and stop

Report the exact command and passed, failed, skipped, or not-run outcome.
Keep useful failure output and the reason for a skipped mechanism.
Stop when the focused proof and necessary repository gates pass.
A local pass does not establish hosted CI or release publication for another revision.
