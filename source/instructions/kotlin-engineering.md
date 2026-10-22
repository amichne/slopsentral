# Kotlin Engineering

Use Kotlin types to retain domain proofs: value classes or constrained
constructors for meaningful scalars, sealed hierarchies for finite alternatives,
and exhaustive `when` expressions without catch-all branches for closed domains.
Parse external values once and pass refined values inward.

Keep pure decisions separate from Gradle, filesystem, network, IDE, clock, and
process effects. Model expected failures as sealed outcomes with case-specific
data. Put public or cross-module behavior with the type that owns its invariant;
avoid extension-heavy designs that scatter ownership or permit meaningless
receiver/argument combinations.

When changing branches, preserve smart casts, cleanup, and effects. Use
compiler-backed tests for newly rejected states. Run the narrowest relevant
Gradle or Kotlin check first, then the repository-required validation. Treat
wrapper integrity, task selection, and generated project state as explicit
effect boundaries rather than evidence about the pure core.

Prefer expression-body functions and explicit value branches. Prohibit
`?: return` and non-local returns inside scope-function lambdas. Select `let`,
`run`, `apply`, and `also` by their receiver, result, and effect semantics.
Keep scopes shallow and effects explicit.

Give coroutines and Flow collectors an explicit lifetime owner. Preserve
cancellation and define completion, replay, buffering, and permitted loss.
Keep unit-test state local to each invocation. Use real components, with no
mocks, spies, scripted stubs, fake collaborators, shared fixtures, or global dispatcher overrides.
