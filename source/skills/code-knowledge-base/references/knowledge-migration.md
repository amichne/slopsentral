# Knowledge Migration

Convert existing notes, documents, or metadata into one-concept-per-file OKF documents.
Preserve source meaning and metadata. Keep the input unchanged.

## Procedure

1. Identify the source and a separate output directory before a write.
   Use the destination that the user requests. State the chosen destination if none exists.
2. Run [source-evidence.md](source-evidence.md) to record source identity and reconcile export coverage.
   Inventory each source item, its facts, and its supported relationships.
3. Map every item to a stable concept path and non-empty `type`.
   Split multi-topic notes. Keep a source-to-concept map to expose omissions and duplicates.
4. Copy supported metadata into standard fields or explicit producer extensions.
   Do not invent descriptions, resources, dates, or links.
5. Put structural data under `Schema`, runnable examples under `Examples`, and source citations under `Citations`.
6. Create links for supported relationships and add indexes for each navigable directory.
7. Record the actual migration date and source in `log.md`.
8. Run the format procedure in [knowledge-page-contract.md](knowledge-page-contract.md).
9. Compare the source-to-concept map with the output and report unresolved facts or links.

Repeated imports from identical input must preserve concept identity without duplicate pages.
Counts do not prove semantic preservation. Review facts and citations from each mapped source item.
