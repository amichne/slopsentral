# Primitive Boundary Ownership

Use when changing Kotlin module groups, domain values, nullability, raw
construction/extraction, or the BuildLogic checks that defend those boundaries.

## Declare The Trusted Module

A module group is an explicit set of Gradle projects for one domain capability,
not a package prefix guessed from filenames. Settings or a settings-owned typed
registry must assign each production project to one group and designate exactly
one primitive boundary module for that group. Reject missing, duplicate, or
unclassified ownership. Do not create one repository-wide boundary god module.

The boundary module owns constrained value declarations, their raw parsers,
serialization and external adapters. Its public surface toward core consumers
contains only domain values, capabilities, and closed outcomes. Keep raw storage
and parsing internal or private; unchecked construction must remain private to
the invariant owner. Core modules depend on that typed surface, never vice versa.
Keep implementation dependencies off the exposed API. Integration code selects
typed capabilities; it does not become a second raw parsing site.

Allow core to depend on its registered boundary's domain-only API. Reject direct
core dependencies on implementation libraries, public implementation-type
leakage, and reverse edges from boundary to core. This provides API isolation,
not runtime dependency isolation: Gradle `implementation` dependencies can still
reach the consumer runtime graph. Do not configure a blanket adapter-module
dependency ban that rejects the registered boundary itself.

Kotlin `internal` is module-wide, not package-private. An adapter in another
module cannot access an internal constructor or backing value without breaking
this boundary. Do not solve that by making `.value` public or adding friend
paths. Keep the raw operation in the boundary owner. If a compatibility or
platform constraint requires a different topology, record the exact exception,
owner, affected signatures, and replacement enforcement instead of claiming
the one-boundary rule holds.

## Distinguish Domain Primitives From Implementation Storage

Meaningful identifiers, amounts, names, paths, statuses, and protocols must use
domain types across owners. Use constrained value classes for single scalars,
sealed variants for alternatives, and focused records for composite invariants.
Aliases, `Any`, maps of raw fields, and generic wrappers that retain raw payloads
do not establish domain meaning. Keep primitive extraction at raw ingress/egress.

This is not a ban on primitive machine representation, local loop counters,
collection sizes, Boolean predicates, or arithmetic inside the owning type.
Private storage and such local operations are allowed; a raw domain contract is
not. Prefer private storage over public wrapper fields. A checker needs an
explicit classification of these allowed uses, not a blanket search for `Int`.

## Keep Core Non-Null And Failures Closed

Outside the boundary module, authored production declarations and inferred
state must be non-null. Represent meaningful absence with domain-named sealed
cases and non-null payloads. Distinguish absence from parse rejection and effect
failure. Do not move `T?` into a generic payload, widen to `Any`, add sentinels,
or use `!!` to satisfy the surface rule. Translate nullable library operations
and Java platform types in the boundary; use non-null library alternatives where
available. Keep any unavoidable external override in a scoped adapter.

Expected failure is a closed operation-owned outcome, not an open exception
channel. Exhaustive consumers omit `else`; a new variant must require a decision.
Translate documented adapter failures once, preserving cancellation, interruption,
and unknown defects rather than reporting them as absence or success.

## Enforce Through BuildLogic, Prove Through Consumers

Reuse the repository's convention-plugin build. The convention must apply the
policy to every production compilation/source set, including new projects,
without relying on each module author to opt in. Settings validates membership;
the convention wires per-module checks into compilation or the required `check`
and CI path. BuildLogic is build-time policy, not a product dependency or a
runtime routing service.

Use Kotlin visibility and distinct types for native compiler barriers. For rules
the language permits, wire a version-compatible compiler plugin or resolved-type
analysis task. Prefer an existing semantic checker that covers the obligation;
do not invent a compiler plugin when an existing check suffices. An API-only
checker cannot prove the absence of nullable locals or raw internal flows.

The gate must inspect expanded aliases, inferred and nested generic types,
platform types, construction/extraction visibility, and forbidden dependency
edges. Include generated sources in coverage or isolate them behind the boundary.
Report unsupported targets or incomplete analysis as missing evidence, not a pass.
Do not add blanket suppressions, a growable allowlist, or test friend paths to
make production misuse compile.

Use consumer compilations without friend access and Gradle TestKit fixtures:

| Obligation | Reject | Accept/control |
| --- | --- | --- |
| Distinct domain identity | Swap two different IDs backed by `String` | Correct ID types |
| Construction and extraction | Unchecked constructor or raw accessor from core | Typed boundary capability |
| Non-null core | Explicit/inferred nullable state, nested nullable payload, alias escape | Exhaustive present/absent cases |
| Closed failure | Omitted new sealed case or catch-all that hides it | Each success/absence/failure handled |
| Group ownership | Zero/two boundary modules, unclassified project, reversed edge | One registered boundary and allowed edges |
| Gate integration | New module or source set bypasses policy | Its violating fixture fails the required build |

Run a known-valid control first so a missing compiler, resolution error, or
broken fixture cannot masquerade as rejection. For native compiler constraints,
assert the intended diagnostic; for policy constraints, assert the semantic
gate's diagnostic. State which mechanism rejected each misuse.

For an existing codebase, migrate one complete path (boundary, value, consumer,
proof) at a time. Preserve compatibility explicitly and name remaining debt.
This reference defines an enforcement contract; installing this skill does not
install a Gradle or Kotlin compiler plugin in the consuming repository.

## Authority

- [Kotlin visibility](https://kotlinlang.org/docs/visibility-modifiers.html): module and friend-compilation limits.
- [Value classes](https://kotlinlang.org/docs/inline-classes.html): representation, visibility, boxing, and interop.
- [Sealed hierarchies](https://kotlinlang.org/docs/sealed-classes.html): closed alternatives and exhaustive handling.
- [Gradle TestKit](https://docs.gradle.org/current/userguide/test_kit.html): plugin consumer tests.

Check documentation against the consuming build's pinned versions before using
version-sensitive APIs or claiming cross-platform coverage.
