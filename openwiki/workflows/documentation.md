---
type: Workflow
title: Maintain source-backed documentation
description: Rewrite and refresh OKF explanations through native Claim review, coverage and freshness checks, local prose assessment, and review-only automation.
tags: [documentation, okf, claims, freshness, glossary]
sources:
  - id: openwiki-source-dcf38279ea35c3c91917811a
    resource: repo://.github/workflows/documentation-site.yml
  - id: openwiki-source-6d4b4e707b8d60b6ccfa3425
    resource: repo://.github/workflows/openwiki-update.yml
  - id: openwiki-source-2bf8a58918c9cbf16d14dae1
    resource: repo://docs/coverage.json
  - id: openwiki-source-77749248b9076e3dac86353b
    resource: repo://docs/glossary.json
  - id: openwiki-source-7165a6dbdabe3fcefb4e2a4e
    resource: repo://docs/mintlify.md
  - id: openwiki-source-1c7a3779ec83cce228ff9a9e
    resource: repo://docs/site.json
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-e14c3521bbc2e703193cadf9
    resource: repo://source/instructions/engineering-design.md
  - id: openwiki-source-62bf20b2fca146abb9011c20
    resource: repo://source/skills/code-knowledge-base/references/knowledge-backend-handoff.md
  - id: openwiki-source-29299f56541b8236fc4f50d6
    resource: repo://source/skills/code-knowledge-base/references/portable-documentation.md
  - id: openwiki-source-fce7a6054d61269783034ac4
    resource: repo://source/skills/code-knowledge-base/scripts/documentation.py
  - id: openwiki-source-5aeb8b8adffe48c4411461e5
    resource: repo://source/skills/controlled-technical-writing/references/glossary-authoring.md
  - id: openwiki-source-2bcafe0f5357d25a9920e218
    resource: repo://tools/ci.py
  - id: openwiki-source-ce19ceaef5961f90bb6decb5
    resource: repo://tools/public_docs.py
  - id: openwiki-source-00110e15b75d856174b63939
    resource: repo://tools/python_checks/test_documentation.py
generated: { by: "codex", at: "2026-11-05T05:22:10.565Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-11-05T05:22:10.565Z
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

## Adopt the same practice in another project

Code Knowledge Base ships the [portable runtime](../../source/skills/code-knowledge-base/scripts/documentation.py), its lock, a schema, and a complete example project.
The [adoption procedure](../../source/skills/code-knowledge-base/references/portable-documentation.md) explains configuration and consumer provenance.
It does not need the Slopsentral checkout, its Node dependencies, or its project tooling.

Schema version 2 selects source roots, document roots, entrypoints, auxiliary pages, areas, archives, and explicit fingerprint exceptions.
It also selects `OKF` or `OPENWIKI` with the knowledge root.
An ordinary OKF project needs no native Claim sidecars or completion checkpoint.
An OpenWiki project keeps the native lifecycle and its stronger admission prerequisites.

Slopsentral's `bin/slopsentral-docs` uses that same runtime.
Its project policy lives in `docs/coverage.json`, including the deliberate product-version exceptions.
The runtime contains no implicit Slopsentral paths or release exceptions.
The [package assertions](../testing/validation.md#exercise-the-distributed-practice-independently) run shipped bytes in independent Git projects for all four providers.

The review lock must use a separate output path outside every prepared input.
It cannot replace a source, document, configuration, or native evidence file.
An existing target needs the `KNOWLEDGE_REVIEW` kind and valid receipt structure.
The writer consumes an admitted target and stages the receipt before replacement.
The kind describes the format, without cryptographic authentication or hostile-writer guarantees.

Review affected source and explanations before `record`.
CI runs `check` without refreshing expected fingerprints or generating pages.
A copied script and lock remain pinned consumer assets whose upstream revision and digests need a deliberate update.

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

## Project canonical explanations to the public site

[site.json](../../docs/site.json) maps current guides and OKF concepts to Mintlify routes, navigation, and redirects.
The [site runtime](../../tools/public_docs.py) projects those sources into `docs/public`.
OpenWiki remains the knowledge owner.
The public copy removes native producer metadata and keeps the canonical body.
Repository links become public routes or GitHub source links.
Code examples keep their literal content.

After source review and native finalization, refresh the public projection:

```sh
mise exec -- slopsentral-site sync
npm run docs:check
```

The first command changes generated site input.
The second rejects stale input before the native Mintlify build and link assessment.
An absent `docs/public` tree cannot pass as an empty selection.
The ordinary source gate also invokes this projection admission.

Mintlify reads `main/docs/public` from `amichne/slopsentral`.
The [site workflow](../../.github/workflows/documentation-site.yml) separately examines deployed content after a main build.
It compares all mapped pages, including link destinations and code indentation, with the expected canonical content.
Missing pages and stale bodies fail within its bounded retry interval.
A matching response does not establish browser layout or Mintlify's exact hosted build SHA.
Use the [site procedure](../../docs/mintlify.md) for deployment status, browser evidence, and recovery.
