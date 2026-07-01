---
name: "kotlin-standards"
description: "Use when Kotlin work needs type-driven modeling, parse-dont-validate boundaries, semantic package layout, explicit failures, API review, or package cohesion checks."
---

# Kotlin Standards

Use this skill as the Kotlin standards router. Stable policy belongs in
instruction concepts; detailed examples and heuristics live in references.

## Operating Rules

- Frame boundary input, trusted domain output, invariant owner, and expected
  failure shape before editing.
- Prefer Kotlin types over comments, conventions, nullable flags, primitive
  tags, and repeated checks.
- Parse untrusted input once at boundaries, then pass trusted domain models
  inward.
- Keep side effects at the edge; keep important rules pure, immutable, or
  intentionally confined.
- Follow the nearest established repository pattern before adding abstraction.
- Test observable correctness, not implementation shape.
- Treat `kotlin-horizontalization-check` and `gradle-check-green` hook output as
  evidence.

## Workflow

1. Inspect the immediate package, tests, and existing abstractions.
2. Load `kotlin-code-correctness` when the task needs repo-level Kotlin policy.
3. Choose the narrowest semantic unit that owns the change.
4. Add one tracer-bullet public-behavior test, then implement the smallest
   vertical slice.
5. Refactor only while green.
6. Run the narrowest useful verification command before broadening scope.
7. Re-score the change and fix any `Fail` before finishing.

## Reference Map

Load only the smallest reference that matches the task:

- Layout: `layout-package-code-style.md`, `horizontalization-heuristic.md`
- Types and boundaries: `type-safety-patterns.md`, `types-domain-modeling.md`,
  `parse-dont-validate-examples.md`, `types-errors-and-testing.md`
- API design: `api-dsl-choices.md`, `api-parameter-selection.md`,
  `api-builders-and-configuration.md`, `api-extensions-and-factories.md`,
  `api-surface-stability.md`, `api-review-guides.md`
- Idiom and smells: `idioms.md`, `kotlin-antipatterns.md`,
  `types-dsls-and-generics.md`

## Ownership Boundary

- `kotlin-code-correctness` owns evergreen Kotlin acceptance policy.
- `kotlin-agentic-correctness` owns file-backed implementation workflow.
- `kotlin-gradle-validation` owns Gradle command execution and build evidence.
- `kotlin-review` owns review orchestration and reviewer routing.
- `negative-capability-proof` owns before/after proof that invalid Kotlin states
  or operations are no longer representable.
