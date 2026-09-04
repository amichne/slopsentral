# Proof-Carrying Domain Values

Use a named representation when a primitive carries meaning or an invariant and
escapes a tiny private scope. Good candidates include identifiers, normalized or
non-empty text, bounded quantities, money, dates, paths, versions, tokens,
correlation keys, and constrained collections.

## Rules

- Keep unchecked construction private to the owning boundary.
- Make parsing or creation return either the proven value or a finite failure.
- Normalize during construction so downstream code cannot observe an
  unnormalized valid value.
- Keep the primitive carrier hidden until an outer adapter must serialize it.
- Use a small shared trait or protocol only when several real domain values need
  the same proven behavior.
- Prefer a compact domain vocabulary reused across many endpoints over one
  wrapper per call site.

A type alias, comment, naming convention, or validator that returns the original
primitive does not preserve proof. In dynamic languages, use opaque module
construction, branded values, closed records, schemas, and executable boundary
checks to create the strongest available barrier.

## Review Questions

- Can two same-shaped values with different meanings be exchanged accidentally?
- Can callers construct an invalid or unnormalized instance?
- Does a successful check return the stronger value directly?
- Is raw extraction confined to serialization or another explicit edge?
