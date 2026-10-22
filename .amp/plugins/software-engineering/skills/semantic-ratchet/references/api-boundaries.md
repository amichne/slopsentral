# API boundaries and invariant decomposition

For each operation, record these facts together:

| Obligation | Required decision |
| --- | --- |
| Input fact | What callers must already prove |
| Owner | Type or module permitted to establish it |
| Construction | Parser, constrained constructor, or legal transition |
| Success | Stronger representation retained by every consumer |
| Failure | Finite cases with evidence specific to each case |
| Effects | Explicit capabilities and when they may run |
| Proof | Accepted example and independently specified forbidden path |

Choose a member for intrinsic behavior, a pure module function for operations
spanning peers, a factory for refinement, and a capability for retained effects
or policy. Receiver syntax never establishes ownership. A generic abstraction
must eliminate an observed duplication while preserving the same obligations.

A success map changes only success. A fold names every variant. A zip or traversal
states ordering, short-circuit or accumulation behavior, and whether effects have
already occurred. Preserve failure identity unless a declared transformation
refines it. Avoid universal error bags that admit meaningless combinations.

Closures capture immutable domain values only in the core. Inject effect
capabilities at the orchestration boundary. Name callback invocation count,
ordering, lifetime, cancellation, and escape behavior when those affect the
contract. Test that a rejected precondition never calls the effect. A function
type alone does not establish purity; language enforcement varies.

For each documented exception from an external API, identify the invariant that
could not be established. Translate that exception at the narrow adapter into
a closed outcome. Separate absence, denied access, timeout, malformed input,
and stale evidence when callers can act differently. Do not broadly catch bugs,
interruptions, or cancellation. Unknown outcomes fail closed. Never recover by
manufacturing a stronger value or reporting a skipped check as successful proof.

This process synthesizes the repository's Kotlin API Surface Design ownership,
domain-value, and higher-order practices. Kotlin retains its value-class, sealed
hierarchy and interop details. Python Tooling supplies strict
union checking and runtime boundary checks without claiming compiler-enforced
private constructors or purity.
