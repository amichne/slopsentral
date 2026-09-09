---
name: kotlin-agentic-correctness
description: Use for Kotlin implementation or review where type-level invariants, semantic caller discovery, or cross-module verification materially affect correctness; not for routine Gradle troubleshooting or generic delivery work.
---

# Kotlin Agentic Correctness

Coordinate the Kotlin-specific decisions that change implementation shape. Stable
language policy, repository topology, and verification breadth live in the
`kotlin-engineering` instruction. Do not restate that policy as a turn-local
task file.

## Operating Contract

- Refine boundary data into trusted Kotlin types and carry those types inward.
- Use sealed variants, constrained construction, capability-specific APIs, and
  closed expected failures when they make an invalid state unreachable.
- Use repository-native compiler, test, and source-navigation evidence. When
  textual caller discovery is ambiguous, fail closed and use the semantic
  support available in the execution environment.
- Use the generic `tdd` skill for behavior changes and
  `kotlin-gradle-validation` only when Gradle execution or report diagnosis is
  part of the task.
- Keep Git, PR, CI, and release ownership in delivery skills.

## Evidence Policy

The proof is the focused executable check and its observed result, not a second
workflow filesystem.

- Prefer repository-native tests, compiler checks, Gradle reports, and current
  command output.
- Do not create `.agent-turn/`, task Markdown, red/green shell scripts, scorecard
  files, or copied tool payloads for an ordinary uninterrupted change.
- Add a checked-in wrapper only when the repository lacks a stable command that
  maps the claim to exit status and the wrapper has continuing regression value.
- Use the repository's existing handoff mechanism for interrupted, long-running,
  or multi-agent work. If none exists, use the compact `tdd` handoff shape in the
  status or final response rather than manufacturing persistent state.

## Workflow

1. Identify the boundary input, stronger domain type, invariant, finite expected
   failures, owner, and smallest check that can disprove completion.
2. Inspect only the topology and symbols needed for that boundary. Resolve
   identity or caller ambiguity through the environment's semantic support.
3. For a behavior change, add or tighten one public-behavior check. Run the same
   working directory, command, fixtures, and meaningful environment RED and
   GREEN; infrastructure failure is not RED.
4. Implement the narrowest vertical slice. Keep effects in adapters and pure
   domain behavior independent of filesystem, network, time, and ambient state.
5. Refactor while the focused check stays green.
6. Widen only across affected owners and consumers: focused test or compile,
   owning module, direct consumers, then repository or installed artifact when
   the changed contract reaches those boundaries.
7. Report exact commands and outcomes, changed public boundaries, and residual
   risk. Do not equate generated logs or a broad build with stronger proof.

## Reference Map

- Stable Kotlin policy, repository topology, and widening: `kotlin-engineering`
- Executable-check discipline and isolation: `tdd`
- Gradle failure diagnosis: `kotlin-gradle-validation`
- Type-system before/after proof: `negative-capability-proof`
- Focused design and review: `kotlin-design-practices`,
  `kotlin-api-surface-design`, and `kotlin-review`
