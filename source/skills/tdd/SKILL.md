---
name: tdd
description: Use when proving behavior changes or auditing executable proof, including empty test selections, runner failures, and RED/GREEN claims. Characterize refactors with existing checks; prose and formatting changes use their normal validators.
---

# Executable-Check TDD

Choose the smallest executable oracle for the changed claim: a test, compiler,
type checker, schema validator, linter, or repository command. Read the nearest
repository instructions and inspect the current owner, callers, and existing
checks first. An inherited plan describes a hypothesis, not a missing feature.

## Workflow

1. State the acceptance behavior and inspect whether the current code already
   satisfies it. Choose reuse, characterization, a behavior change, or a bounded
   investigation. Do not create a duplicate implementation or manufacture RED
   when the existing invariant is proved.
2. Specify the working directory, exact command, fixtures, meaningful
   environment, assertion source, expected failure, and passing criterion.
   Check tooling readiness separately. Zero selected tests and infrastructure
   failures do not prove the product behavior.
3. For a behavior change, add or tighten the focused check and run it before
   implementation. Accept RED only when the intended missing invariant causes
   the failure. Reuse and refactors start from passing characterization.
4. Implement the smallest real path that satisfies the claim. Keep effects
   explicit and preserve refined domain values and finite expected failures.
   Do not refactor while red or add behavior outside the acceptance boundary.
5. Run the same check specification. Accept GREEN only when the relevant
   assertion executed and passed. Explain skips and cached evidence. Refactor
   while green and rerun the affected check after meaningful changes.
6. Run repository-required checks and widen across affected owners or consumers.
   Repeat or broaden only for changed inputs, failures, or a named unresolved
   concern. Do not add implementation-mirroring tests for reversible prose or
   formatting changes.
7. Report the exact checks, observed outcomes, changed invariant, and limits.
   Keep evidence in native reports and the handoff; ordinary work needs no new
   task filesystem. Commit or push only when the requested end state or
   applicable repository policy authorizes publication. Do not request again
   for authority already supplied. A local TDD loop does not require a remote.

A timeout, missing command, broken fixture, permission error, or unrelated
failure requires readiness repair or isolation; it is not product RED. A passing
aggregate without a relevant assertion is not GREEN. Remaining required work
prevents completion.

## Reference Routing

- Read [codebase-preflight.md](references/codebase-preflight.md) when deciding
  whether a proposed implementation is needed.
- Read [executable-check-contract.md](references/executable-check-contract.md)
  when selecting a non-test oracle or qualifying RED/GREEN evidence.
- Read [isolation.md](references/isolation.md) when checks mutate state, call a
  service, or evaluate an agent in a disposable workspace.
- Read [tracer-bullets.md](references/tracer-bullets.md) for an uncertain boundary;
  distinguish a retained real path from a disposable feasibility spike.
- Read [tests.md](references/tests.md) for behavior tests and
  [mocking.md](references/mocking.md) for external boundaries.
- Read [interface-design.md](references/interface-design.md) or
  [deep-modules.md](references/deep-modules.md) when test friction exposes a seam.
- Read [refactoring.md](references/refactoring.md) only after passing proof.
- Read [handoff.md](references/handoff.md) for interrupted or sustained work.

## Completion Criteria

The current-codebase decision is supported by source and consumer evidence.
The relevant check executed, required validation passed, publication matches the
requested scope, and the handoff distinguishes reuse, characterization, and
observed RED/GREEN without claiming a narrower check proves a broader result.
