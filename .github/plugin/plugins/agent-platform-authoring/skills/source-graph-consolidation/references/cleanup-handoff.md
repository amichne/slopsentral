# Cleanup Handoff

Use this reference before proposing deletion or symlink replacement for scattered
source paths.

## Cleanup Boundary

Promotion does not imply cleanup, but proven-dead source should not remain in
the tree for historical evidence. Cleanup starts only after:

- the canonical primitive exists and validates;
- the original source path is recorded in `garden/manifests/promotions.json`;
- the generated inventory confirms the canonical replacement;
- duplicate digest or explicit review proves replacement equivalence;
- rollback or backup path is known;
- cleanup is in the current user-approved scope.

## Ledger Intent

`garden/manifests/cleanup-ledger.json` is the approval and rollback gate for
risky runtime, symlink, or cross-root replacement work. A future entry should
record:

- original `sourcePath`;
- `canonicalPath`;
- cleanup `decision`;
- verification evidence;
- rollback path.

Do not add ledger entries as a substitute for promotion evidence. Do not keep
dead authored source for archaeology once deletion is in scope and validation
passes.

## Validation

`cleanup-ledger.json` is governed by the source graph validation contract.
Validate with:

```sh
node source/tools/validate-source-graph.mjs
```
