---
type: Workflow
title: Maintain source-backed documentation
description: Rewrite and refresh OKF explanations through native Claim review, coverage and freshness checks, local prose assessment, and review-only automation.
tags: [documentation, okf, claims, freshness, glossary]
sources:
  - id: openwiki-source-6d4b4e707b8d60b6ccfa3425
    resource: repo://.github/workflows/openwiki-update.yml
  - id: openwiki-source-2bf8a58918c9cbf16d14dae1
    resource: repo://docs/coverage.json
  - id: openwiki-source-77749248b9076e3dac86353b
    resource: repo://docs/glossary.json
  - id: openwiki-source-e14c3521bbc2e703193cadf9
    resource: repo://source/instructions/engineering-design.md
  - id: openwiki-source-62bf20b2fca146abb9011c20
    resource: repo://source/skills/code-knowledge-base/references/knowledge-backend-handoff.md
  - id: openwiki-source-5aeb8b8adffe48c4411461e5
    resource: repo://source/skills/controlled-technical-writing/references/glossary-authoring.md
  - id: openwiki-source-47ec153299eb0886a6e326f4
    resource: repo://tools/documentation.py
  - id: openwiki-source-00110e15b75d856174b63939
    resource: repo://tools/python_checks/test_documentation.py
generated: { by: "codex", at: "2026-11-03T18:18:32.121Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-11-03T18:18:32.121Z
---

# Maintain source-backed documentation

Documentation forms part of the engineering change contract.
A reader must reach the responsible source, understand the mechanism, and see the limits of its evidence.
The [documentation practice](../../docs/documentation.md) owns the concrete repository procedure.

## Establish coverage before prose

Start with the reader's action or decision.
Map functional areas to their entry points, owners, state, failures, direct consumers, and executable evidence.
Use `docs/coverage.json` to connect those areas with the current guides and OKF explanations.
Page counts and directory inventories do not establish mechanism coverage.

Reuse `docs/glossary.json` and its generated [reader view](../../docs/GLOSSARY.md).
The glossary already covers the wiki.
Its definitions remain provisional because independent reader review remains absent.
A rewrite in another repository creates a minimal source-backed glossary only when no owner exists.
Assessment alone and ordinary code work do not authorize glossary creation.

## Complete the native lifecycle

Resolve the exact Git top-level before the OpenWiki run.
Start or resume an `update` run through the external integration.
If planning is necessary, submit canonical page paths with source seeds and useful neighbors.
Do not plan generated indexes as content pages.

Consume one assigned page at a time.
Examine current source, write valid OKF frontmatter, and reconcile its material Claims.
Confirm stale Claims only after source review.
Keep unchanged identities, revise the same proposition under its existing identity, and retract propositions the page no longer asserts.

Continue the persisted queue until the integration returns `complete`.
Then finish the run through OpenWiki.
Native finalization owns indexes, sidecars, source versions, provenance, and completion metadata.
Never repair those files by hand or substitute standalone OKF validation.

## Examine links, freshness, and prose

After native finalization, use the repository gate:

```sh
mise exec -- slopsentral-docs check
```

A changed source or page invalidates the recorded byte agreement.
The review record also binds native Claim sidecars and completion metadata.
A later change needs another review.
Review the affected explanations and rejected links before the explicit `record` operation.
Keep the receipt diff with the reviewed source diff.
The gate establishes coverage and byte agreement. It does not grade the meaning of a Claim.

Assess changed technical prose with the pinned Vale procedure:

```sh
mise exec -- slopsentral-prose changed
```

Keep the report and examine findings at their reported lines.
An `ASSESSED` result does not mean that the report is clean.
Readability measurements do not prove reader comprehension.

## Recurring updates propose review

[Update Repository Documentation](../../.github/workflows/openwiki-update.yml) runs on selected main pushes, manual dispatch on main, and daily at 09:17 UTC.
It serializes runs, reads trusted main source, and does not persist checkout credentials.
The runtime is OpenWiki 0.6.1 with model `gpt-5.6-terra`.

The workflow needs separate `OPENAI_API_KEY` and `OPENWIKI_PR_TOKEN` repository secrets.
The first authenticates generation. The second needs repository Contents and Pull requests write access for the documentation PR.
Keep values in the private secret interface.

The workflow rejects a noncomplete native checkpoint or an active run file.
It checks the glossary and proposes only generated wiki changes.
Checkpoint-only changes do not select a PR.
When substantive changes select a PR, `.last-update.json` and `.page-manifest.json` remain eligible.
The path allowlist excludes `.run.json` and authored `INSTRUCTIONS.md`.
It neither auto-merges nor publishes executable source changes.
A locally accepted workflow does not prove that its credentials exist or that an Actions run succeeded.
