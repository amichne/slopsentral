# Sources And Synthesis Record

This skill is a local rewrite. It does not copy upstream skill payloads,
scripts, examples, or templates.

## Audited Source

| Source | Audited commit | License | Decision |
| --- | --- | --- | --- |
| [chrisbanes/skills: kotlin-api-design](https://github.com/chrisbanes/skills/tree/2d202c722c1815007619ee0b667401b9d42e456e/skills/kotlin-api-design) | `2d202c722c1815007619ee0b667401b9d42e456e` | Apache-2.0 | Retain semantic function ownership, explicit sealed-result mappings, value-class interop checks, and narrow multiplatform seams |

## Local Refinements

Retain:

- choosing member, top-level, extension, factory, or collaborator by semantic
  ownership;
- explicit sealed-outcome branches that preserve smart casts and force review
  when a subtype is added;
- value-class decisions that account for equality, serialization, Java interop,
  and boxing;
- semantic common APIs with platform mechanics at leaves.

Strengthen or add:

- constrained construction and closed typed parse failures for domain values;
- higher-order combinators that preserve proof and finite outcome spaces;
- explicit effect capabilities instead of callbacks that hide I/O, time, or
  randomness;
- negative-capability proof for public construction and transition claims;
- the repository rule that type aliases do not represent domain identity.

Exclude:

- references to sibling upstream Compose and control-flow skills that are not
  part of this standalone primitive;
- unchecked public domain constructors and type-alias advice that would weaken
  the local Kotlin correctness standard;
- fixed framework choices or platform versions.

## Current Review

See [provenance.md](provenance.md) for the 2026-09-05 upstream review. The earlier
synthesis above remains the record of the original local implementation.
