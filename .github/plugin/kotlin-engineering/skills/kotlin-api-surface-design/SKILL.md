---
name: "kotlin-api-surface-design"
description: "Use when designing or reviewing Kotlin public or cross-module APIs, function ownership, higher-order combinators, value-class boundaries, exhaustive outcome transformations, or Kotlin Multiplatform platform seams."
---

# Kotlin API Surface Design

Design Kotlin APIs so domain meaning, proven invariants, finite failure, and
platform independence remain visible to callers. Prefer the smallest public
surface that preserves those facts; fluent syntax and generic reuse are not
goals when they weaken ownership or exhaustiveness.

## Operating Contract

- Name the domain concept, semantic owner, callers, and proof carried across
  the boundary before choosing a function shape.
- Put behavior on the smallest accurate owner. An extension changes call
  syntax, not ownership, and must not hide parsing, policy, state, I/O, time,
  randomness, or dependencies.
- Keep higher-order domain combinators pure and total. They must preserve or
  explicitly refine the closed outcome space rather than collapse failures
  into exceptions, nulls, booleans, strings, or an unconstrained catch-all.
- Map sealed outcomes with explicit branches. Do not add `else` where a new
  subtype should force caller review.
- Use constrained domain values at public boundaries. Unchecked construction
  stays private or internal to the invariant owner.
- Keep shared Kotlin code semantic. Platform SDK types and lifecycle mechanics
  stay behind narrow interfaces or narrowly justified `expect`/`actual` leaves.

## Workflow

1. Inspect the declaration and real callers. Use semantic tooling for symbol
   identity and reference scope when available.
2. Classify the surface: intrinsic behavior, peer operation, construction,
   retained capability, outcome transformation, or platform seam.
3. Choose the narrowest type and function owner that preserves domain language,
   invariants, and finite failures.
4. Read only the focused reference needed for the decision below.
5. Verify changed call sites, exhaustive branches, serialization or interop
   contracts, and every affected Kotlin source set.

## Reference Routing

- Read [function-ownership-and-composition.md](references/function-ownership-and-composition.md)
  for members, top-level functions, extensions, factories, services,
  higher-order combinators, or sealed-outcome mappings.
- Read [domain-value-surfaces.md](references/domain-value-surfaces.md) for value
  classes, data classes, constrained construction, serialization, Java interop,
  equality, or boxing-sensitive paths.
- Read [multiplatform-boundaries.md](references/multiplatform-boundaries.md) for
  common code, source sets, native SDKs, lifecycle ownership, test fakes, or
  `expect`/`actual` choices.
- Read [sources.md](references/sources.md) when updating this skill or auditing
  its upstream provenance and local refinements.

## Completion Criteria

- Every public operation has a recognizable semantic owner.
- Higher-order APIs preserve typed success and every caller-visible failure.
- Invalid domain values and illegal outcome transitions lack public
  construction paths.
- Platform details remain at adapter leaves, and affected source sets compile.
- Compatibility and behavior claims have focused compiler or test evidence.
