# Kotlin Code Correctness Standard

## Scope

This standard applies to Kotlin implementation, review, and refactoring work.
It is the always-on instruction for Kotlin code shape: domain modeling,
boundary parsing, package ownership, dependency choice, module boundaries,
expected failures, state safety, Kotlin idiom, and proof.

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
3. Treat parsing and validation as refinement from a weaker input type to a
   stronger output type, then pass that proof-carrying result inward.
4. Put constructors, factories, parsers, and visibility on the type that owns
   the invariant.
5. Keep package and file boundaries semantic. A package should have one
   recognizable owner, not a horizontal bucket of similarly prefixed files.
6. Use the Kotlin standard library when it fits. Prefer a maintained,
   compatible library over custom infrastructure for a solved technical domain.
7. Keep third-party bindings in focused adapters. Let one minimal integration
   module select implementations without leaking their types into domain APIs.
8. Keep side effects at adapters and keep core rules pure, immutable, or
   intentionally confined.
9. Prove the behavior with the narrowest compiler, test, semantic-tooling, or
   hook evidence that can fail for the right reason.

## Reference Map

- `type-safety`: language-agnostic invalid-state prevention. Copilot packages
  expose it as `instructions/type-safety.md`.
- `schema-driven-design`: schemas, serialized data, manifests,
  configuration, and boundary contracts. Copilot packages expose it as
  `instructions/schema-driven-design.md`.
- `kotlin-application-stack`: library selection and focused bindings for
  kotlinx.serialization, Ktor, Clikt, and optional GraalVM native CLI delivery.
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

## Principle 3: Preserve Proof Through Refinement

A parser, validator, normalizer, lookup, authorization check, or state-admission
operation must refine a weaker input `T` into a stronger result `S`. When the
operation has expected failure, it must return a closed typed outcome carrying
either `S` or a finite failure `E`. It must not use `Boolean`, `Unit`, `null`,
the original `T`, an arbitrary exception, or a side effect as its success
protocol.

Restrict construction of `S` to the owner of the transition. Callers must
consume `S`; invoking the transition and discarding its result loses the proof.
Do not unpack `S` back into primitives until an explicitly named outer boundary
requires the raw representation.

Every changed production parser or refiner API must document the concrete
transition, the invariant gained by `S`, the finite expected failure when one
exists, and the outer boundary where raw extraction is permitted.

**Rule:** Information must move from weaker to stronger representations without
discarding established invariants.

## Principle 4: Make Expected Failure Explicit

Routine parse failures, unsupported variants, missing fields, invalid state
transitions, and recoverable domain failures should have typed outcomes where
the local API can support them. Reserve exceptions for exceptional conditions or
established platform contracts.

**Rule:** A caller should be able to see expected failure behavior from the type
signature or documented boundary contract.

## Principle 5: Keep Ownership Semantic

Packages and files should map to domain units, features, protocols,
capabilities, or lifecycle owners. Avoid package roots filled with peer files
that differ only by repeated prefixes, suffixes, or horizontal layer names.

Keep one primary public type or sealed root per file by default. Keep tightly
owned factories, variants, and extensions with the owning type. Split when the
new unit has a separate name, lifecycle, dependency direction, or test surface.

**Rule:** If reviewers must reconstruct ownership from filenames and
conventions, the package shape is too weak.

## Principle 6: Confine State And Effects

Prefer `val`, immutable collections at boundaries, pure transformations, and
small adapters around IO. Confine mutation to builders, caches, test fixtures,
or platform integration points with clear ownership.

**Rule:** Core rules should be testable without ambient mutable state,
filesystem state, network state, or hidden coroutine timing.

## Principle 7: Prefer Standard And Established Libraries

Use the Kotlin standard library for ordinary transformations and value
operations when it states the behavior directly. Before writing infrastructure
for a solved technical domain, inspect the repository's current dependencies
and maintained libraries with a compatible typed contract.

Choose a dependency only when it fits the target platform, maintenance,
license, security, runtime, and test constraints. Do not add a library for a
small operation the standard library expresses clearly. Do not hand-roll JSON,
HTTP, CLI parsing, cryptography, protocol handling, or retry machinery merely
to avoid a focused dependency.

**Rule:** Custom infrastructure needs evidence that the standard library and
established candidates do not satisfy the repository's actual constraints.

## Principle 8: Keep Implementation Bindings Private

Pure contract and core modules should expose domain-owned types, focused
capabilities, and finite failures. Framework, transport, wire, engine,
serializer, persistence, and SDK types belong in focused adapter modules.

Let one small application or integration module select concrete adapters and
own their configuration. A replacement should require changes to that binding
and its adapter, not to domain callers. Use one reusable contract suite to prove
equivalent implementations. Do not create a wrapper that merely renames every
operation and type from the dependency.

Enforce this dependency direction with the repository's architecture checks.
If no check exists, add a focused Gradle or test gate that rejects adapter
dependencies in pure modules and implementation types in their public APIs.

**Rule:** A public cross-module API must not reveal an implementation detail
unless that module explicitly exists to extend the implementation library.

## Principle 9: Audit Every Changed Production File

Before completion, review every changed production Kotlin file. Reject newly
introduced primitive domain contracts, repeated validation, nullable control
state, string protocols, unrestricted construction of refined values, discarded
refinement results, and raw extraction outside the named boundary. This audit
has no file-local exception; an unavoidable platform constraint must be isolated
at an adapter and recorded explicitly.

**Rule:** A proof-carrying design is incomplete while another changed file can
silently discard or recreate the weaker representation.

## Principle 10: Prove The Invariant

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
| Validator returns `Boolean`, `Unit`, `null`, or its original input | Return a stronger type or a closed typed failure outcome |
| Caller discards a parser or validator result | Consume the refined value and carry it inward |
| Refined value immediately unpacked to a primitive | Keep the stronger representation until the named outer boundary |
| String or integer tag dispatch | Dispatch on typed variants |
| Package roots with many similarly prefixed peer files | Split by semantic owner or introduce a sealed root |
| Expected failures hidden in exceptions | Use typed outcomes where the local API supports them |
| Hand-written infrastructure for a solved technical domain | Use the standard library or a maintained compatible library, or record the constraint that rules them out |
| Framework, transport, serializer, engine, or SDK types in domain APIs | Introduce a domain-owned capability and keep the binding in an adapter selected by the integration module |
| One-to-one wrappers that mirror a dependency | Define the narrower domain capability callers need |
| Module-boundary policy enforced only by review | Add a dependency or public-API gate that fails on implementation leakage |
| Broad build claims without focused evidence | Run and cite the narrowest relevant proof |

## Self-Audit

Before accepting Kotlin work, verify:

- Can any caller construct an invalid instance?
- Does adding a variant force every required handler to update?
- Does core code receive raw boundary data that should have been parsed first?
- Does each parser or validator return and document a stronger representation?
- Do all callers consume the refinement result and preserve it inward?
- Are expected failures explicit and testable?
- Does each changed package have a recognizable semantic owner?
- Did the change hand-roll behavior already owned by the standard library or a
  maintained compatible library?
- Does any public cross-module API expose a third-party implementation type?
- Could the integration module select another implementation without changing
  domain callers, and does a shared contract suite prove that claim?
- Does a mechanical dependency or API check fail when implementation types leak
  into a pure module?
- Are mutable state and effects confined to named boundaries?
- Did verification run at the narrowest level that proves the changed behavior?
