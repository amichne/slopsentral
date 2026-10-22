---
name: kotlin-design-practices
description: "Use for Kotlin domain types, APIs, expression bodies, scope functions, coroutine and Flow lifecycles, isolated unit tests, and atomic changes across callers."
---

# Kotlin Design Practices

Keep each invariant with one owner. Carry established facts through constrained
Kotlin values, sealed outcomes, and explicit capabilities. Keep decisions pure.

## Workflow

1. Inspect repository instructions, the Kotlin language version, declarations,
   callers, and existing tests. Name the invariant and the nearest invalid case.
2. Choose reuse, extension, or a new representation from source evidence.
   Resolve uncertain symbol identity or caller coverage with available semantic tools.
   Do not claim complete caller coverage from an ambiguous text search.
3. Parse external input once. Keep unchecked construction private to the
   invariant owner. Pass stronger values inward without repeated guards or primitive reconstruction.
4. Choose the smallest semantic owner for each function. Keep callbacks pure.
   Preserve every finite failure through higher-order composition.
5. Preserve branch cases, predicate order, effects, cleanup, and smart casts.
   Use exhaustive `when` expressions for closed domains without an `else` branch.
   Parse open input into an explicit unknown case before closed-domain handling.
6. For authorized implementation, use one focused behavior test or compiler
   rejection as the acceptance proof. Run it before the production change.
   Keep the command, fixtures, directory, and meaningful environment stable through RED and GREEN.
   Infrastructure failures do not establish RED.
   Start behavior-preserving changes from a passed characterization test.
7. Change the smallest complete path from its caller to its result.
   Keep filesystem, network, clock, process, and mutable-state effects in explicit adapters.
   Keep serialization and format selection in adapters with a shared serialization contract.
8. Expand evidence only across affected owners and direct consumers.
   Compile each affected source set. Run focused tests for changed interop, serialization, branches, and legal transitions.
9. Report exact commands, outcomes, changed contracts, and evidence limits.
   Use `kotlin-review` for read-only review. Read `kotlin-gradle-validation` only when the user explicitly selects that skill.
   Its explicit-only policy does not prevent necessary repository-native compiler or Gradle commands.

## Design Rules

- Use value classes with private construction for constrained scalars.
  Use sealed variants for finite states and case-specific failures.
- Keep tiny function-local facts local. Add a carrier when a consumer needs the established fact.
- Put operations on their semantic owner. Extension syntax alone does not establish ownership.
- A success transform must preserve each failure variant unless its result explicitly refines that failure.
  A fold must handle each case. Traversal must declare order and short-circuit or accumulation behavior.
- Keep SDK types and lifecycle mechanics in adapters.
  Use a domain capability when runtime selection or lifetime ownership matters.
- Guarded subtype branches need an unguarded branch for the rest of that subtype.
  Use guards only when the configured Kotlin language version supports them.
- Preserve `use`, `finally`, cancellation, transactions, and exception behavior.
  Do not bypass compiler rejection with `!!`, unchecked casts, or mutable staging.
- Prefer expression-body functions with explicit result types for public contracts.
  Prohibit `?: return`, including labeled returns. Produce a value for each branch instead.
  Choose `let`, `run`, `apply`, or `also` by receiver and result semantics.
  Avoid nested scopes, non-local lambda returns, and effects hidden inside value transformations.
- Give each coroutine and Flow collector an explicit lifetime owner.
  Preserve cancellation and define completion, failure, buffering, and replay behavior.
- Keep unit-test state inside each test invocation. Use real components and explicit inputs.
  Prohibit mock-based tests, spies, scripted stubs, and fake replacements for production collaborators.
  Do not use class fixtures, global state, ambient clocks, or shared dispatcher overrides.
- Use repository-native evidence. Do not create `.agent-turn/`, scorecards, copied payloads,
  or separate RED/GREEN scripts for an ordinary uninterrupted change.
  Add a wrapper only when a stable command is absent and the wrapper has lasting regression value.
- Use `tdd` for an executable-check contract and interrupted-work handoff.
  Use `negative-capability-proof` when the claim concerns forbidden construction or calls.

## Reference Routing

- For domain construction, read [domain types](references/types-domain-modeling.md),
  [parse examples](references/parse-dont-validate-examples.md), and
  [type-safety patterns](references/type-safety-patterns.md).
- For finite failures and their tests, read [errors and tests](references/types-errors-and-testing.md).
- For function placement or outcome combinators, read
  [function ownership](references/function-ownership-and-composition.md).
- For equality, serialization, Java interop, or boxing, read
  [domain value surfaces](references/domain-value-surfaces.md).
- For expression bodies, scope functions, or null branches, read
  [expression flow](references/expression-flow.md).
- For coroutine or Flow ownership, read [coroutines and Flow](references/coroutines-and-flow.md).
- For isolated coroutine or Flow tests, read [coroutine tests](references/coroutine-tests.md).
- For guards, early returns, or evaluation order, read
  [branch preservation](references/branch-preservation.md).
- For package ownership, read [layout](references/layout-package-code-style.md).
  For structural warning signs, read [antipatterns](references/kotlin-antipatterns.md)
  and [the horizontalization heuristic](references/horizontalization-heuristic.md).
  Treat these signals as review aids, never proof of a defect.
- For a DSL or generic constraint, read [DSL types](references/types-dsls-and-generics.md)
  and [DSL choices](references/api-dsl-choices.md).
- For parameters, factories, or configuration, read
  [parameters](references/api-parameter-selection.md),
  [extensions and factories](references/api-extensions-and-factories.md), and
  [builders](references/api-builders-and-configuration.md).
- For API compatibility or a focused design review, read
  [surface stability](references/api-surface-stability.md) and
  [review guides](references/api-review-guides.md).
- For a local syntax decision, read [idioms](references/idioms.md).
- For source attribution, read [API sources](references/api-sources.md),
  [API provenance](references/api-provenance.md), and
  [branch provenance](references/branch-provenance.md).
  Their upstream license remains in [Apache-2.0.txt](references/Apache-2.0.txt).

## Completion

Each invariant has one owner. Consumers accept its stronger values.
Legal behavior passes the focused test. Named invalid calls fail at the stated enforcement mechanism.
Compiler evidence proves only its encoded obligation. External effects, freshness,
single consumption, and installed behavior need separate evidence when the claim includes them.
