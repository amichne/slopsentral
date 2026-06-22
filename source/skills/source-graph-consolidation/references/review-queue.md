# Review Queue

Use this reference when deciding what to promote from local source graph
evidence, promotion manifests, duplicate reports, or user-identified scattered
primitive roots.

## Queue Meaning

- `canonical`: already lives in this repository and should usually be kept.
- `authored-local`: source-controlled or locally-authored material outside this
  repo. Review before promotion.
- `runtime`: installed local runtime copy. Use for provenance or drift checks,
  not as the first promotion target when an authored source exists.
- `backup`: historical copy. Review only after authored and runtime copies are
  understood.
- `installed-marketplace`: external marketplace/cache material. Use as
  reference material only; do not raw-copy it into canonical primitives.

## Selection Rules

- Prefer coherent capability families over isolated files.
- Promote from authored local sources before runtime caches.
- Treat duplicate digests as cleanup candidates only after a canonical
  replacement exists.
- Treat duplicate names with different digests as semantic review work, not as
  automatic conflict resolution.
- Ignore installed marketplace duplicates unless they reveal first-party name or
  digest collision risk.

## Evidence Commands

```sh
node source/tools/validate-source-graph.mjs
python3 source/skills/primitive-quality-audit/scripts/primitive_audit_record.py check
```

After running these, inspect the changed source roots, `garden/manifests/promotions.json`,
`garden/manifests/primitive-audits.json`, and any current duplicate evidence the
user supplied or generated for the task. Do not keep stale generated reports in
source merely to explain old promotion history.
