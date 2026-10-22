# Kotlin Engineering

Use Kotlin types to retain domain proofs: value classes or constrained
constructors for meaningful scalars, sealed hierarchies for finite alternatives,
and exhaustive `when` expressions without catch-all branches for closed domains.
Parse external values once and pass refined values inward.

For every Kotlin production change, read `kotlin-design-practices` before editing;
for Gradle scripts, catalogs, plugins, generators, or module edges, read
its build-logic contract. Keep `kotlin-gradle-validation` explicit-only;
necessary repository-native Gradle commands do not require that skill. Apply these rules
to each changed owner, not only when the task explicitly requests type safety.

Declare module groups in build settings and designate exactly one primitive
boundary module per group. It owns raw ingress/egress and constrained value
construction; other modules consume domain types. Local arithmetic and private
value-class storage are not primitive domain contracts. Keep raw accessors
hidden from consumers. Wire dependency and resolved-type checks through the
repository's BuildLogic convention plugin; a plugin name is not enforcement.

Do not introduce nullable declarations or inferred nullable state in core code.
Model meaningful absence with domain-named sealed alternatives and non-null
contents. Confine platform nullability to the boundary and translate it once.
Expected failures must be closed domain outcomes, not `Result<T>` with an open
`Throwable` channel, null, or exceptions. Preserve cancellation and defects.

Keep pure decisions separate from Gradle, filesystem, network, IDE, clock, and
process effects. Model expected failures as sealed outcomes with case-specific
data. Put public or cross-module behavior with the type that owns its invariant;
avoid extension-heavy designs that scatter ownership or permit meaningless
receiver/argument combinations.

Use catalog-backed dependency/plugin versions and convention plugins rather
than copied build policy. Preserve lazy provider-wired task inputs and outputs,
explicit module direction, and focused incremental verification. A clean build
does not prove no-change reuse or correct source/ABI invalidation.

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

For existing violations, migrate the smallest complete caller path; do not
silently widen the task into a repository rewrite. Name any remaining violation,
compatibility exception, or missing checker. Never claim compiler enforcement
from policy prose, a skill read, a regex scan, or a passing ordinary build.
