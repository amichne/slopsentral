---
name: semantic-ratchet
description: Design constrained domain values and pure decisions. Use when parsers, conditional predicates, or consumer APIs lose established facts, admit invalid states, or repeat checks.
---

# Constrained Domain Design

Reduce the set of values and behaviors that callers must consider.
Use familiar domain types and standard language features.
Keep each established fact in the value that its consumer accepts.

## Procedure

1. Name the invariant and its consumer. Inspect existing types, constructors, callers, and tests.
2. Reuse the current owner when it already enforces the invariant.
3. Parse an external primitive into a constrained value or a finite failure.
4. Give each conditional predicate one yes-or-no assertion about known values.
5. Separate parsing, membership, normalization, and comparison. Keep those operations pure.
6. Pass stronger values forward. Keep unchecked construction under the invariant owner.
7. Handle closed variants exhaustively. Preserve failures through composition.
8. Examine one accepted case and the nearest rejected case with the project tools.
9. State the established fact, its scope, and the limits of the evidence.

A predicate returns true or false.
A refinement returns success with a stronger value or failure with a finite reason.
Exhaustive case selection can return one of several cases.
Traversal can process a whole collection.
Neither needs a forced sequence of binary predicates.

For a date range, parse the date first. Reject a malformed date at that step.
Compare date values in a separate predicate.
Do not hide parsing or effects inside the comparison.

Keep external effects in explicit adapters.
Keep local facts local when no consumer needs a stronger representation.
Add a type or abstraction only when it excludes a concrete misuse.
Use the repository toolchain and native host workflow for implementation and delivery.

## References

- For the rationale, read [proof discipline](references/proof-discipline.md).
- For scalar and collection types, read [domain values](references/domain-values.md).
- For finite failures, read [closed outcomes](references/closed-outcomes.md).
- For operation ownership and composition, read [API design](references/api-boundaries.md).
- For legal transitions, read [state and capabilities](references/state-and-capability-modeling.md).
- For module access, read [module design](references/module-boundaries.md).
- For a review, read [the audit checklist](references/audit-checklist.md).
- For an implementation, read [the refactor procedure](references/refactor-playbook.md).
- For language examples, read [the Kotlin example](references/kotlin-proof-example.md) or [the API example](references/api-proof-example.md).

## Completion

The consumer accepts the established fact without reconstructing it from primitives.
The named misuse fails under the selected compiler, schema, or runtime assertion.
The accepted case still passes.
Static acceptance does not prove external effects or model behavior.

This guidance uses [Parse, do not validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)
and [Names are not type safety](https://lexi-lambda.github.io/blog/2020/11/01/names-are-not-type-safety/).
