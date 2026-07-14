# Kotlin Code Correctness Standard

## Scope

This standard applies to Kotlin implementation, review, and refactoring work.
It is the always-on instruction for Kotlin code shape: domain modeling,
boundary parsing, package ownership, expected failures, state safety, Kotlin
idiom, and proof.

Skills own task workflows. Hooks own mechanical checks. This concept owns the
stable acceptance standard that should survive outside any one plugin or
runtime.

This concept does not own generic branch, commit, pull request, release, or CI
operations. It also does not replace local repository instructions, generated
contracts, or narrower API schemas.

## Quick Use

1. Name the boundary input and the trusted domain output before editing.
2. Move finite variants, constrained primitives, lifecycle states, and
   capability differences into Kotlin types.
3. Parse untrusted data once at the edge, then pass trusted domain models
   inward.
4. Put constructors, factories, parsers, and visibility on the type that owns
   the invariant.
5. Keep package and file boundaries semantic. A package should have one
   recognizable owner, not a horizontal bucket of similarly prefixed files.
6. Keep side effects at adapters and keep core rules pure, immutable, or
   intentionally confined.
7. Prove the behavior with the narrowest compiler, test, semantic-tooling, or
   hook evidence that can fail for the right reason.

## Reference Map

- `type-safety`: language-agnostic invalid-state prevention. Copilot packages
  expose it as `instructions/type-safety.md`.
- `schema-driven-design`: schemas, serialized data, manifests,
  configuration, and boundary contracts. Copilot packages expose it as
  `instructions/schema-driven-design.md`.
- Kotlin examples in source concept folders illustrate typed variants,
  constrained construction, composite encodings, wrapper display, and boundary
  assertions. They are optional supporting material; Copilot packages do not
  need them to apply this instruction.

These references are supporting material. This file must still be usable by
itself.

## Conflict Handling

When this standard conflicts with local repository instructions, generated
models, platform APIs, performance constraints, or compatibility requirements,
state the conflict explicitly. Preserve invalid-state prevention unless the
local evidence proves the model must be narrower or broader.

Do not use casts, reflection, unchecked suppression, nullable escape hatches, or
runtime checks to bypass a model that can be expressed with Kotlin types.

## Principle 1: Model Domain States Directly

Use value classes, enums, sealed interfaces, sealed classes, focused data
classes, and capability-specific interfaces for important domain concepts.
Prefer one named concept over raw `String`, `Int`, `Boolean`, `Map`, nullable
fields, or parallel arrays.

**Rule:** If the domain distinguishes values, states, operations, or variants,
the Kotlin model must distinguish them too.

## Principle 2: Parse At Boundaries

Boundary code may reject raw CLI arguments, JSON, files, HTTP payloads, database
rows, Gradle reports, hook events, or SDK responses. Core code should not
re-check the same shape repeatedly.

**Rule:** After parsing succeeds, downstream code should accept a trusted type,
not the raw transport representation.

## Principle 3: Make Expected Failure Explicit

Routine parse failures, unsupported variants, missing fields, invalid state
transitions, and recoverable domain failures should have typed outcomes where
the local API can support them. Reserve exceptions for exceptional conditions or
established platform contracts.

**Rule:** A caller should be able to see expected failure behavior from the type
signature or documented boundary contract.

## Principle 4: Keep Ownership Semantic

Packages and files should map to domain units, features, protocols,
capabilities, or lifecycle owners. Avoid package roots filled with peer files
that differ only by repeated prefixes, suffixes, or horizontal layer names.

Keep one primary public type or sealed root per file by default. Keep tightly
owned factories, variants, and extensions with the owning type. Split when the
new unit has a separate name, lifecycle, dependency direction, or test surface.

**Rule:** If reviewers must reconstruct ownership from filenames and
conventions, the package shape is too weak.

## Principle 5: Confine State And Effects

Prefer `val`, immutable collections at boundaries, pure transformations, and
small adapters around IO. Confine mutation to builders, caches, test fixtures,
or platform integration points with clear ownership.

**Rule:** Core rules should be testable without ambient mutable state,
filesystem state, network state, or hidden coroutine timing.

## Principle 6: Prove The Invariant

Choose proof that matches the risk:

- compiler rejection for unreachable misuse;
- focused tests for public behavior and expected failures;
- semantic tooling for symbol identity, references, hierarchy, and diagnostics;
- Gradle tasks for module-level compile or test proof;
- hooks for package-layout and turn-end checks.

**Rule:** Do not claim a Kotlin change is complete from intent. Name the command,
tool output, test, hook result, or explicit reason verification could not run.

## Anti-Patterns To Reject

| Anti-pattern | Fix |
|---|---|
| Primitive identifiers crossing core logic | Introduce a constrained domain type |
| Boolean mode flags controlling behavior | Model finite variants or capability-specific APIs |
| Nullable fields encoding mutually exclusive states | Use typed variants with only valid fields |
| DTOs or maps passed into core code | Parse into domain models at the boundary |
| Repeated validation at use sites | Move validation to constructors, factories, or parsers |
| String or integer tag dispatch | Dispatch on typed variants |
| Package roots with many similarly prefixed peer files | Split by semantic owner or introduce a sealed root |
| Expected failures hidden in exceptions | Use typed outcomes where the local API supports them |
| Broad build claims without focused evidence | Run and cite the narrowest relevant proof |

## Self-Audit

Before accepting Kotlin work, verify:

- Can any caller construct an invalid instance?
- Does adding a variant force every required handler to update?
- Does core code receive raw boundary data that should have been parsed first?
- Are expected failures explicit and testable?
- Does each changed package have a recognizable semantic owner?
- Are mutable state and effects confined to named boundaries?
- Did verification run at the narrowest level that proves the changed behavior?
