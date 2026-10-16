# Source evidence and coverage

Use this procedure for imported knowledge, export audits, and source drift.
Limit the inventory to the requested material and its dependencies.
Keep the input unchanged. Use existing repository manifests and checkers before
adding automation or a second knowledge store.

## Bind the source

Record repository identity, selected worktree, examined commit, and dirty-source
scope. For an export, record its origin, retrieval date, file hash, and cited or
indexed revision when available. These fields describe different identities.
A timestamp or matching path does not prove that an export describes current code.

Compare the imported revision with the selected source. If they differ, inspect
the relevant diff and recheck affected claims. Preserve the old version as
history. Mark unknown revisions and unavailable source as unverified.
Do not replace missing evidence with a guessed revision or an empty drift list.

## Reconcile coverage

1. Find the authoritative inventory when available: source tree, official
   export, live sidebar, backend manifest, or generator registry.
2. Compare stable page IDs and paths, not just total counts. Distinguish index
   entries, duplicate pages, and missing or unexpected pages.
3. Inventory diagrams, code examples, attachments, and source citations within
   the affected pages. Matching page sets do not establish asset completeness.
4. Map each item to its preserved input, destination, and validation result.
   Keep raw diagram source with its page ID and ordinal or stable diagram ID.
   A screenshot or rendered SVG does not replace authored diagram text.
5. Recover omissions from an available source within the authorized scope.
   Preserve exact bytes before correction. If recovery is unavailable, report
   the missing IDs and the scope whose completeness remains unknown.

An export audit can finish with a complete gap report. It does not require an
unrequested migration or full-site recovery.

## Verify claims

For each material claim, keep the source path or symbol, examined revision,
canonical owner, and result: supported, contradicted, or unverified.
Use current code, schemas, generated contracts, tests, or runtime observations
that actually establish the claim. Generated wiki prose and citations are leads.
An existing citation does not prove its sentence; inspect the cited declaration.

Resolve conflicting sources through their owners. Exact defaults belong to
the registry or schema; generated Reference follows that owner. Explanations
can link there without becoming another fact owner.
Update stale facts and affected indexes through the existing backend procedure.
Keep accepted decisions, proposals, and unresolved questions distinct.

## Report separate evidence

Report expected and recovered items, missing assets, parse failures by page,
rendered inspections, and verified or unresolved claims separately.
Name the renderer or checker and its version when it affects the result.
Successful recovery proves possession of content. A successful parse or render
does not prove current architecture, runtime readiness, or source accuracy.
Keep source-specific paths, counts, and audit receipts in repository-local evidence.
