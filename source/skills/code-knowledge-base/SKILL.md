---
name: code-knowledge-base
description: "Create or refresh source-backed OKF concepts, migrate notes, assess source drift, or generate deterministic signature indexes. Use for knowledge bundles and backend handoffs."
---

# Code Knowledge Base

Keep one atomic concept per OKF document and one source owner per claim.
Use code, schemas, compiler facts, generated contracts, and tests as evidence.
Treat indexes as navigation aids whose claims still need source evidence.

## Workflow

1. Identify the repository, reader, source roots, knowledge backend, and requested scope.
   Reuse the existing store. An ordinary code task does not authorize knowledge generation.
2. Select the smallest operation: read, create, refresh, migrate, assess impact, or generate signatures.
   For a query, start at `index.md` and read only concepts that answer the question.
3. Gather source paths, symbols, schemas, and module facts before prose.
   Use compiler tools, LSP, Gradle metadata, or current signatures when they exist.
4. Define stable concept paths and links before new pages.
   Keep source facts, accepted decisions, proposals, and unresolved gaps distinct.
5. Change the selected pages and their indexes together.
   Update inbound links after a rename. Keep historical `log.md` links unchanged.
6. Run the format and source-evidence procedures from [knowledge-page-contract.md](references/knowledge-page-contract.md).
   Record each command and result. An impact list does not prove page correctness.
7. Assess changed prose with controlled-technical-writing.
   Report missing tools, unresolved citations, and unproved host behavior.

## Select the Necessary Reference

- For concept fields, links, history, format checks, or graph output, read [knowledge-page-contract.md](references/knowledge-page-contract.md).
- For tracked or sibling storage, read [knowledge-overlay.md](references/knowledge-overlay.md) before a write.
- For an unsupported backend or an authorized migration, read [knowledge-backend-handoff.md](references/knowledge-backend-handoff.md).
- For imported notes or exports, read [knowledge-migration.md](references/knowledge-migration.md).
- For Kotlin or Gradle sources, read [kotlin-gradle-okf-principles.md](references/kotlin-gradle-okf-principles.md).
- For generated signatures, read [signature-contract.md](references/signature-contract.md).
- For upstream assets or inherited format behavior, read [provenance.md](references/provenance.md).

## Completion

Each concept has a stable path, a non-empty `type`, and explicit source evidence.
Changed sources map to affected concepts or a reported coverage gap.
Missing documents and unavailable Git are failures, never proof of no drift.
Signature output is deterministic, and unknown syntax has an explicit outcome.
Keep generated provider output separate from authored source.
