---
name: kotlin-branching
description: "Use when changing Kotlin when expressions, guards, nullable branches, early returns, or smart casts while preserving behavior and closed-domain exhaustiveness."
---

# Kotlin Branching

Reshape a decision without changing which inputs reach each effect. This skill
owns branch structure; public API ownership remains a separate design decision.

## Workflow

1. Identify the classified value, possible cases, side effects, and cleanup.
   Read the repository's Kotlin language version before choosing syntax.
2. Use a subject `when` for one classified value. Keep unrelated predicates in
   an `if` chain or subjectless `when`; do not invent a subject for symmetry.
3. Handle each closed-domain case explicitly. Keep a deliberate fallback for
   open input. A guard refines a case; it does not cover that entire case.
4. On a supported language version, put a branch-local predicate in a guard and
   put its unguarded case after it. Split comma-separated cases before adding a
   guard. Otherwise retain an ordinary nested condition.
5. Remove invalid or absent input early only when doing so preserves evaluation
   order, exception behavior, resource cleanup, and transaction boundaries.
6. Compile the affected source set and test changed branch boundaries. Preserve
   smart casts without introducing `!!`, unchecked casts, or mutable staging.

## References

Read [branch preservation](references/branch-preservation.md) for a guarded
rewrite, open-input fallback, or a review of evaluation order. Read
[provenance](references/provenance.md) when updating the skill.

## Completion Criteria

Every original input case reaches the same result and effects. Closed outcomes
remain exhaustive, open outcomes retain a fallback, and the affected source set
compiles. A cosmetic rewrite with no simpler decision structure should be left
unchanged.
