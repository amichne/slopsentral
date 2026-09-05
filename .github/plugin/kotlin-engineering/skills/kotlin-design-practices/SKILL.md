---
name: kotlin-design-practices
description: "Use when choosing Kotlin domain types, invariant owners, parse boundaries, closed failures, or package responsibilities; not for branch-only refactors or public function ownership."
---

# Kotlin Design Practices

Model the domain and place each invariant with one owner. This skill owns domain
representation and package responsibility. Use kotlin-api-surface-design for a
public function or platform seam, kotlin-branching for a decision expression,
and kotlin-gradle-validation for build execution.

## Workflow

1. Inspect the relevant types, call sites, tests, and package boundaries. State
   the invariant and the raw input that can violate it.
2. Parse once at ingress. Carry a constrained value, closed variant, or explicit
   capability inward instead of repeating checks or adding Boolean state flags.
3. Choose the smallest owner that can enforce the invariant. Keep pure rules
   separate from I/O and mutable resources. Do not add an abstraction solely for reuse.
4. Read the focused reference below. Use the repository's established idioms when
   they preserve the required proof; explain a concrete exception when they do not.
5. Prove the changed behavior and any forbidden construction path. A layout
   heuristic is a review signal, not proof of a semantic defect.

## Reference Routing

Read `references/types-domain-modeling.md` for domain representation,
`references/parse-dont-validate-examples.md` for ingress,
`references/types-errors-and-testing.md` for closed failures,
`references/layout-package-code-style.md` for package ownership, and
`references/types-dsls-and-generics.md` for generic or DSL constraints.
Other bundled references provide targeted examples; load only the relevant one.

## Completion Criteria

Each invariant has one owner, invalid input has an explicit outcome, and effects
remain visible at the boundary. Evidence supports the changed behavior. Do not
claim compiler proof for a rule enforced only by review or a naming convention.
