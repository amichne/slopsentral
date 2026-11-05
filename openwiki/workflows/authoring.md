---
type: Workflow
title: Change source with linked evidence
description: Prepare a focused engineering contract, change the authoritative owner, and examine executable proof and affected knowledge together.
tags: [authoring, workflow, checks, knowledge]
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
generated: { by: "codex", at: "2026-11-05T05:22:10.565Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-11-05T05:22:10.565Z
---

# Change source with linked evidence

A source change ends with the requested behavior, its decisive evidence, and current explanations of the affected system.
The [engineering baseline](../../source/instructions/engineering-design.md) supplies the shared rules.
Specialized skills supply language and domain procedures.

## Establish the contract before design

Name the consumer, observable outcome, invariant, scope, and non-goals.
Examine the checkout revision, local changes, owning implementation, direct callers, schemas, and existing tests.
Trace one real execution path when the behavior crosses components.

Choose reuse, extension, a new owner, or investigation from that evidence.
A plan or inherited summary cannot establish that a feature is absent.
Define the smallest faithful oracle, its expected result, and its nearby rejection case.
State what the oracle cannot prove and what evidence ends the task.

For a behavior change, first establish failure for the intended missing behavior.
A missing dependency, zero selected assertions, or an unrelated timeout does not establish product failure.
For reuse or a behavior-preserving refactor, start from passing characterization.

## Prepare the checkout

Install the declared mise tool and use the checkout commands:

```sh
mise install
mise exec -- slopsentral-setup
```

Setup synchronizes locked Python dependencies and runs `npm ci --ignore-scripts`.
It installs the pinned documentation tools from `docs/tooling` with lifecycle scripts disabled.
It does not silently install uv.
Projection accepts exactly Pkl 0.32.0 through the separate runtime setup procedure.
Keep local output and installed consumer caches outside authored edits.

## Change the authoritative owner

Edit primitives under `source/` and maintenance effects under `tools/`.
Plugins reference primitives instead of copying their payloads.
Pkl owns projected shapes. Regenerate provider trees from source instead of editing them.
Use [ownership](../concepts/source-ownership.md) and [projection](../architecture/projection.md) to find the responsible owner.

Keep domain decisions pure and effects explicit.
A successful parse or transition carries the facts that later consumers need.
Closed failures preserve the case that prevented the invariant.
The public contract excludes named illegal calls where the language can express that limit.

## Examine proof and affected knowledge

Run the focused oracle under the same setup as its initial failure or characterization.
Then run the [required gates](../testing/validation.md) for the edited surface.
Composition edits need the source graph and fresh Codex, Copilot, and Amp projections.
Python changes need Ruff, strict Pyright, and pytest within the declared scope.
The Python gate stops on the first failed or unavailable stage and keeps a distinct unavailable exit.

Examine the explanations linked to the changed owner in `docs/coverage.json`.
Recheck affected material Claims through OpenWiki.
Change inaccurate prose and links, or record the reason that current prose remains accurate.
After native finalization, run the [documentation procedures](documentation.md).

Report passed, failed, skipped, and not-run evidence with its actual scope.
Decision evaluation uses canonical skill text and explicit references with hashes and no-skill controls.
Its runner disables tools, automatic discovery, and network search.
`Validate Source` runs offline skill controls and keeps verified provider archives.
It does not run the live skill suite during normal CI.
Offline fixtures do not establish live model behavior.
Local installation does not establish host consumption or a published release.
Commit and PR delivery obey the repository's authorization rules. A code PR does not authorize a merge or release.
