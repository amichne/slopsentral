---
name: "negative-capability-proof"
description: "Use for a scoped Kotlin API change that must demonstrate a currently reachable illegal operation or state and then make that misuse unrepresentable."
---

# Negative Capability Proof

Prove one reduction in the Kotlin API's reachable state space. Apply
`kotlin-engineering` for general design and `tdd` for the executable loop.

## Contract

- Stay inside the requested module, package, feature, or file set.
- Select one invariant unless the user asks for more.
- Preserve valid behavior while moving enforcement from runtime checks,
  convention, documentation, or caller discipline into Kotlin types.
- Prefer constrained constructors, sealed variants, capability-specific
  interfaces, restricted visibility, and typed state transitions.
- Do not introduce generic machinery larger than the invariant.
- Make the regression authority a checked-in test or compiler fixture when it
  has lasting value. Do not create a parallel JSON proof record or turn-local
  shell protocol.

## Find The Misuse

Within the requested scope, look for Boolean modes, mutually exclusive nullable
fields, unrestricted constructors, runtime capability checks, illegal lifecycle
transitions, or operations exposed to implementations that cannot support them.

State:

- the invariant;
- the currently reachable misuse and runtime enforcement;
- the smaller target API surface;
- the callers and valid behavior that must remain.

## Baseline, RED, GREEN

Distinguish characterization from TDD:

- **BASELINE** demonstrates that the misuse currently compiles, constructs, or
  reaches a runtime guard. It may pass; do not call it RED.
- **RED** is the desired invariant check failing because the misuse remains
  reachable.
- **GREEN** is the same check specification passing after the type-level change.

A strong compile-time pattern is a compile-testing or repository-native fixture
whose assertion expects the forbidden snippet to be rejected. Before the change
the fixture fails because the snippet compiles; after the API change the same
test command passes. If adding compile-testing infrastructure would outweigh the
invariant, use the narrowest existing public-API or construction-surface test and
state the weaker proof.

Do not use a different `red.sh` and `green.sh`, invert exit codes in wrappers, or
edit the assertion between RED and GREEN. Those protocols prevent direct
comparison and let the model manufacture evidence.

## Refactor

Use the smallest type move that removes the misuse:

- replace primitive tags or mutually exclusive fields with a sealed variant;
- split mixed-capability APIs so only capable values expose the operation;
- restrict construction and return a refined type or closed failure;
- encode lifecycle transitions in receiver and return types;
- keep raw parsing and rejection at the outer boundary.

Search all affected callers semantically when identity is ambiguous. Valid
callers must consume the refined value rather than unpacking it back into
primitives.

## Verification And Handoff

Run the focused invariant check, then the owning module and direct consumers
when the public API changed. Widen further only when the contract crosses a
generated, packaging, or installed-artifact boundary.

Report the before/after reachable state, exact RED and GREEN command and signal,
public migration impact, and any remaining escape hatch. The proof is complete
only when the original misuse is absent and valid behavior remains green.
