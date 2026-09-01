---
name: kotlin-agentic-correctness
description: Use when Kotlin work needs typed design discipline, proof-carrying refinement, repository or module topology, session task evidence, scoped AGENTS.md guidance, Kast semantic tooling, widening Gradle validation, TDD, or PR-ready proof.
---

# Kotlin Agentic Correctness

Use this skill as the workflow wrapper for Kotlin implementation or review work
where correctness depends on domain shape, semantic code understanding, and
executable evidence. Stable Kotlin policy lives in `kotlin-code-correctness`;
this skill owns the turn workflow and proof discipline.

## Operating Contract

- Apply `kotlin-code-correctness` before choosing implementation shape.
- Apply `kotlin-repository-engineering` to module topology, scoped repository
  guidance, task evidence, generated surfaces, and widening verification.
- Model important concepts as value classes, sealed hierarchies, enums, private
  constructors, focused factories, and typed expected failures.
- Parse untrusted data once at the edge; core Kotlin should receive trusted
  domain types, not raw strings, nullable flags, maps, or DTOs.
- Treat JSON, CLI args, hook input, Gradle reports, Kast payloads, and persisted
  workflow state as boundary data with a parser, schema, constructor, or
  validator.
- Prefer native Kast commands for Kotlin identity, references, hierarchy,
  diagnostics, insertion points, renames, and edit validation. Load
  `kast-kotlin-structural-analysis` for chained structural queries when it is
  installed.
- Keep generic Git, PR, release, and CI ownership in delivery skills.

## Workflow

1. Frame the trusted shape: boundary inputs, domain values, invariants,
   expected failures, package owner, and proof target.
2. For implementation work, create file-backed evidence with
   `python3 scripts/kotlin_workflow_state init --repo .`, then record intent
   with `python3 scripts/kotlin_workflow_state intent ...`. Define the numbered
   task under that session, capture each proof with `kotlin_task_evidence run`,
   and validate it with `kotlin_task_evidence check`.
3. Orient semantically with the public Kast command surface before touching
   Kotlin symbols. Use `kast-kotlin-structural-analysis` for chained structural
   queries when it is installed; use native Kast commands for routine lookups.
4. Use TDD for behavior changes. When the generic `tdd` skill is available,
   treat the targeted Gradle or repository command as its stable executable
   check specification. Add the smallest public-behavior test that proves the
   next invariant, parser failure, transition, or API contract.
5. Implement the narrowest Kotlin slice. Keep side effects at boundaries,
   state immutable or intentionally confined, and package layout semantic.
6. Verify in widening rings: Kast diagnostics, targeted Gradle compile/test,
   owning module check, then broader `check` or CI only when the surface
   requires it.
7. Use Kotlin review agents when APIs, boundaries, package shape, nullable
   state, primitive identifiers, or expected failures are affected.
8. Finish with commands run, evidence paths, scorecard result, and any remaining
   `Concern`. Do not claim completion with a `Fail` scorecard dimension.

## Scorecard

Mark each dimension `Pass`, `Concern`, or `Fail`: domain fidelity, boundary
parsing, layout cohesion, error design, state safety, test value, Kotlin idiom,
filesystem evidence, and Kast semantics.

## Reference Map

- Stable Kotlin policy: `kotlin-code-correctness`
- Stable repository policy: `kotlin-repository-engineering`
- Filesystem evidence: `references/filesystem-evidence-contract.md`
- Kast structural queries: `kast-kotlin-structural-analysis` when installed
- Scripts: `scripts/kotlin_workflow_state` and
  `scripts/kotlin_task_evidence`
- Narrow skills: `kotlin-design-practices`, `kotlin-api-surface-design`,
  `kotlin-observability-design`, `kotlin-application-stack`,
  `kotlin-gradle-validation`, `kotlin-review`, and `negative-capability-proof`
- Generic executable-check TDD: `tdd` when installed.
- Generic delivery: use `git-ci-operations` for local Git and
  `effective-delivery` for PR, CI, and release work when installed.
