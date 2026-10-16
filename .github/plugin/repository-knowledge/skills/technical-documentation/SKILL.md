---
name: technical-documentation
description: "Use when creating or revising repository documents, specifications, runbooks, source-backed diagrams, or documentation sites. Owns reader paths, fact ownership, site structure, and rendered verification."
---

# Technical Documentation

Write the smallest document that supports one reader action or decision.
This skill owns document structure, source coverage, and documentation sites.
Use controlled-technical-writing for prose assessment and code-knowledge-base for source-backed OKF bundles.

## Workflow

1. Identify the reader, action or decision, artifact, source material, and destination.
   Resolve routine choices from repository conventions. Ask only when missing information changes the document's purpose or authority.
2. Inspect code, schemas, commands, configuration, tests, and existing documents before prose.
   Record the selected source revision and each imported source's identity. Reconcile affected page and diagram inventories before claiming coverage.
   Label each claim as current behavior, an accepted decision, a proposal, or an unresolved gap.
3. Choose a focused structure with [document-contracts.md](references/document-contracts.md).
   For a substantial specification, establish the decision and evidence before introductions.
   Draft in small sections when the user requests that workflow.
4. If the artifact belongs to a site, identify its configuration, navigation owner, dialect, and generated pages.
   Read [documentation-sites.md](references/documentation-sites.md) for reader paths, mentor comparisons, component support, and rendered checks.
   Change pages, navigation, assets, and links as one scoped unit.
   Preserve the current framework unless the user requests a migration.
5. Generate API and command references from their authoritative registry when one exists.
   Change the generator for generated pages. Give procedures, mechanisms, and exact contracts one canonical home each; cross-link other uses.
   For diagrams, read [diagrams.md](references/diagrams.md) to preserve source, semantics, and rendering evidence.
6. Examine commands, examples, defaults, links, and page claims against their sources.
   Run the repository's documentation build after navigation, configuration, layout, link, or generated-page changes.
   Inspect changed UI and diagrams in the rendered page; a passing build does not establish visible or usable output.
7. Run controlled-technical-writing's shared assessment for changed prose and keep its report.
   Resolve findings or record their location and technical reason.
8. For a substantial document, use [reader-testing.md](references/reader-testing.md) to assess comprehension without conversation context.
   Report unresolved reader questions and distinguish a simulated review from human evidence.

## Site References

- For `zensical.toml`, read [zensical.md](references/zensical.md).
- For `mkdocs.yml` or `mkdocs.yaml`, read [mkdocs.md](references/mkdocs.md).
- For new pages or navigation changes, read [page-structures.md](references/page-structures.md).
- For site conventions or agent reference material, read [prose-structure.md](references/prose-structure.md).

For imported knowledge migration or source drift, use code-knowledge-base's source-evidence procedure.
For Mintlify component details, use the existing mintlify skill and current official documentation.
A request to edit documentation does not authorize publication.

## Completion

The document states its reader action and supports material claims with sources.
Site navigation reaches the changed pages, and generated content keeps its source owner.
Report commands as passed, failed, skipped, or not run.
Separate source verification, asset recovery, build success, rendered inspection, prose measurements, and reader comprehension.
Label examples that did not run and operational steps without runtime evidence.

Read [provenance.md](references/provenance.md) before an upstream import.
