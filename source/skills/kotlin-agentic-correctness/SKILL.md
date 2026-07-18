---
name: kotlin-agentic-correctness
description: Use when Kotlin work needs typed design discipline, invariant-oriented Kotlin standards, filesystem-backed evidence, Kast semantic tooling, Gradle validation, TDD, or PR-ready proof.
---

# Kotlin Agentic Correctness

Use this skill as the workflow wrapper for Kotlin implementation or review work
where correctness depends on domain shape, semantic code understanding, and
executable evidence. Stable Kotlin policy lives in `kotlin-code-correctness`;
this skill owns the turn workflow and proof discipline.

## Operating Contract

- Apply `kotlin-code-correctness` before choosing implementation shape.
- Model important concepts as value classes, sealed hierarchies, enums, private
  constructors, focused factories, and typed expected failures.
- Parse untrusted data once at the edge; core Kotlin should receive trusted
  domain types, not raw strings, nullable flags, maps, or DTOs.
- Treat JSON, CLI args, hook input, Gradle reports, Kast payloads, and persisted
  workflow state as boundary data with a parser, schema, constructor, or
  validator.
- Prefer the packaged `kast` skill or native Kast tools for Kotlin identity,
  references, hierarchy, diagnostics, insertion points, renames, and edit
  validation.
- Keep generic Git, PR, release, and CI ownership in delivery skills.

## Workflow

1. Frame the trusted shape: boundary inputs, domain values, invariants,
   expected failures, package owner, and proof target.
2. For non-trivial work, create file-backed evidence with
   `python3 scripts/kotlin_workflow_state init --repo .`, then record intent
   with `python3 scripts/kotlin_workflow_state intent ...`.
3. Orient semantically with Kast before touching Kotlin symbols. For CLI
   fallback, use `bash scripts/kast_rpc_file.sh` with request and response
   files under `.agent-turn/kotlin-agentic-correctness/`.
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
- Filesystem evidence: `references/filesystem-evidence-contract.md`
- Kast file-first fallback: `references/kast-file-first.md`
- Scripts: `scripts/kotlin_workflow_state`, `scripts/kast_rpc_file.sh`
- Narrow skills: `kotlin-design-practices`, `kotlin-gradle-validation`,
  `kotlin-review`, and `negative-capability-proof`
- Generic executable-check TDD: `tdd` when installed.
- Generic delivery: use `git-ci-operations` for local Git and
  `effective-delivery` for PR, CI, and release work when installed.
