---
name: kotlin-review
description: Use for read-only Kotlin review of invariants, branches, expression flow, coroutine and Flow lifecycles, isolated tests, and typed failures.
---

# Kotlin Review

Review the change for Kotlin contracts that no longer retain what the program
has already proved. Start from behavior and domain meaning, then use Kotlin's
type and branch semantics to determine whether an issue is mechanically real.

## Operating Contract

- Review the changed code and the smallest call paths needed to establish
  behavior. Read repository instructions first and check the configured Kotlin
  language version before relying on version-specific syntax.
- Keep tiny, obvious, function-local facts local. Permit local counters,
  arithmetic, collection sizes, Boolean predicates, and private primitive storage.
  Raw domain contracts crossing owners, nullable platform values, DTOs, and
  external strings belong only at the designated boundary.
  Core absence requires domain-named sealed cases with non-null contents.
  Once parsing, validation, normalization, authorization, lookup,
  or a state check succeeds, require any non-local fact to survive in the value
  or function contract that crosses the boundary.
- Prefer the smallest Kotlin proof carrier that prevents the named misuse:
  constrained value class, enum, sealed hierarchy, private construction,
  state-specific type, capability-specific interface, or typed outcome. Do not
  prescribe generic wrappers or extra abstractions without a concrete invalid
  state to exclude.
- Treat expected failures as finite data. Reserve exceptions for defects,
  violated internal assertions, platform contracts, and exceptional runtime
  failures.
- Keep pure domain decisions independent of filesystem, network, clock,
  process, persistence, and framework effects. A package or naming heuristic is
  supporting evidence, never proof of a defect.
- Report only findings with a reachable impact and a proportionate fix. Do not
  modify the code unless the user also asks for fixes.
- Prefer expression-body functions. Reject `?: return`, labeled Elvis returns, and non-local returns inside scope-function lambdas.
  Preserve behavior with explicit value branches. Keep `let` and `run` transformations distinct from `apply` construction and `also` effects.
- Examine coroutine ownership, cancellation, child completion, Flow replay, buffering, and permitted value loss.
  Reject detached jobs, swallowed cancellation, unowned collectors, and an event contract implemented through conflated state.
- Use test-local subjects, inputs, collaborators, schedulers, and collectors.
  Reject class fixtures, shared setup state, ambient services, and global dispatcher overrides in unit tests.
  Reject mocks, spies, scripted stubs, and fake collaborators. Use real components and separate real-resource integration tests.

## Workflow

1. **Scope the change.** Inspect the diff or requested files, their public
   contracts, direct callers, relevant tests, and owning package or module. Name
   any generated or external boundary that limits the review.

2. **Trace established facts.** For each changed parse, check, lookup,
   normalization, authorization, or transition, name the gained fact, where it
   is discarded, the boundary it crosses, and the misuse that remains possible.
   A check that returns `Boolean`, `Unit`, `null`, or the original primitive does
   not carry its proof forward when later code depends on that success.

3. **Inspect the domain shape.** Ask whether distinct same-shaped values can be
   exchanged, invalid instances can be constructed, nullable fields encode
   multiple states, or flags and call order encode a lifecycle. Verify that one
   type or package owns construction and that raw extraction is confined to an
   explicit adapter.
   Check the group's single boundary owner, inferred/nested nullable types,
   public primitive factories/accessors, and closed failures. Distinguish native
   compiler barriers from semantic policy gates; verify the latter actually run
   for new modules and source sets. A naming convention is not enforcement.

4. **Audit branches as behavior.** Identify the classified value, all cases,
   predicates, effects, evaluation order, and cleanup. Prefer a subject `when`
   for one classified value; keep unrelated predicates in an `if` chain or
   subjectless `when`. Closed Kotlin domains should be exhaustive without a
   catch-all; open external input needs a deliberate unknown case before it is
   translated into a closed local type. A guarded subtype branch must retain an
   unguarded branch for the rest of that subtype. Branch rewrites must preserve
   smart casts, exception behavior, `use` and `finally` cleanup, and transaction
   boundaries without `!!`, unchecked casts, or mutable staging.

5. **Follow the stronger value.** Check that callers consume the refined type or
   closed outcome rather than unpacking it immediately, repeating guards, or
   reconstructing primitive protocols across public APIs, modules,
   serialization, persistence, or interop seams.

6. **Establish evidence.** Support each finding with a type signature, reachable
   call path, branch case, test, compiler diagnostic, or focused executable
   check. Prefer a fix that makes the old misuse stop compiling or makes every
   outcome require exhaustive handling. For review-only work, do not run broad
   validation without a concrete need.

7. **Synthesize by root cause.** Merge symptoms when one invariant owner,
   parser, sealed outcome, state-specific type, or branch correction resolves
   them. Order findings by impact; do not invent findings to fill a category.

## Finding Standard

Lead with findings. Each finding includes:

- severity and `file:line`;
- the reachable behavior or contract at risk;
- the established fact that is lost, or the branch case whose behavior changes;
- concrete source evidence and confidence;
- the smallest Kotlin-shaped correction; and
- the compiler check or focused test that would prove the correction.

Use `P0` for reachable catastrophic loss or authority bypass, `P1` for a
demonstrated correctness or public-contract defect, and `P2` for a concrete
maintainability or verification gap. Omit preference-only style notes.

If no finding is justified, say so directly. Report the files and behavior
reviewed, evidence used, and residual uncertainty such as uninspected generated
code, missing call sites, unsupported language-version assumptions, or tests not
run.

## Completion Criteria

- Every finding names a reachable misuse or behavior change, not merely a weak
  representation in isolation.
- Recommended fixes preserve established facts and existing effects while
  reducing representable invalid states.
- Closed branches remain exhaustive, open inputs retain an explicit fallback,
  and guarded cases retain their remainder.
- Evidence strength is stated accurately; review judgment is not presented as
  compiler proof.
