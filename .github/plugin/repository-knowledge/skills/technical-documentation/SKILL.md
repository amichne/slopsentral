---
name: technical-documentation
description: "Create or revise repository documents, proposals, specifications, runbooks, source-backed diagrams, or documentation sites. Use for document structure, source coverage, site navigation, and reader comprehension."
---

# Technical Documentation

Write the smallest document that supports one reader action or decision.
This skill owns document structure, source coverage, and documentation sites.
Use controlled-technical-writing for prose assessment and code-knowledge-base for source-backed OKF bundles.

## Workflow

1. Identify the reader, action or decision, artifact, source material, and destination.
   Resolve routine choices from repository conventions. Ask only when missing information changes the document's purpose or authority.
2. Inspect code, schemas, commands, configuration, tests, and existing documents before prose.
   Label each claim as current behavior, an accepted decision, a proposal, or an unresolved gap.
3. Choose a focused structure with [document-contracts.md](references/document-contracts.md).
   For a substantial specification, establish the decision and evidence before introductions.
   Draft in small sections when the user requests that workflow.
4. If the artifact belongs to a site, identify its configuration, navigation owner, dialect, and generated pages.
   Change pages, navigation, assets, and links as one scoped unit.
   Preserve the current framework unless the user requests a migration.
5. Generate API and command references from their authoritative registry when one exists.
   Change the generator for generated pages. Derive diagrams from real components, states, calls, or schemas.
6. Examine commands, examples, defaults, links, and page claims against their sources.
   Run the repository's documentation build after navigation, configuration, layout, link, or generated-page changes.
7. Apply controlled-technical-writing's source and terminology checks.
   Run the repository's prose checks; use the bundled assessment when requested
   or required by policy, and keep that report. Do not require a new assessment
   toolchain for a small wording edit.
8. For a substantial document, use [reader-testing.md](references/reader-testing.md) to assess comprehension without conversation context.
   Report unresolved reader questions and distinguish a simulated review from human evidence.

## Site References

- For `zensical.toml`, read [zensical.md](references/zensical.md).
- For `mkdocs.yml` or `mkdocs.yaml`, read [mkdocs.md](references/mkdocs.md).
- For new pages or navigation changes, read [page-structures.md](references/page-structures.md).
- For site conventions or agent reference material, read [prose-structure.md](references/prose-structure.md).

For Mintlify, inspect local `docs.json` and the requested deployment before a deployment change.
A request to edit documentation does not authorize publication.

## Completion

The document states its reader action and supports material claims with sources.
Site navigation reaches the changed pages, and generated content keeps its source owner.
Report commands as passed, failed, skipped, or not run.
Separate a successful build, prose measurements, and reader comprehension.
Label examples that did not run and operational steps without runtime evidence.

Read [provenance.md](references/provenance.md) before an upstream import.
