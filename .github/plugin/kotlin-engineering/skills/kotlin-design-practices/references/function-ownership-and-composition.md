# Function Ownership And Composition

Use this reference when selecting a Kotlin function owner or designing a
higher-order public API.

## Ownership Decision

Choose the smallest accurate semantic owner:

| Meaning | Prefer |
| --- | --- |
| Behavior intrinsic to a project-owned type | Member |
| Stateless operation spanning peers with no single owner | Top-level function |
| Construction, parsing, or refinement | Factory on the target type or a named top-level parser |
| Retained policy, state, I/O, clock, locale, randomness, or dependency | Focused capability or collaborator |
| Operation valid for every receiver value with clearer receiver syntax | Narrow extension |

Do not move a correct private member merely because it does not read instance
state. Ownership is semantic, not a data-flow heuristic.

For extensions on primitives, collections, `Flow`, framework types, or
third-party types, require all of the following:

- private or internal cohesive scope;
- validity for every receiver value;
- no hidden policy, effect, or dependency;
- materially clearer receiver syntax;
- no better project-owned owner.

If any condition fails, use a member, named top-level function, parser, or
capability instead. Preserve or deprecate existing public entry points unless a
breaking change is explicitly in scope.

## Higher-Order Domain APIs

Use higher-order functions to compose proven operations, not to erase their
meaning.

- Keep callbacks pure in core APIs. Pass explicit capabilities to an outer
  adapter rather than accepting lambdas that conceal I/O, time, or randomness.
- Prefer operation-specific sealed outcomes. Do not force unrelated failures
  into one universal `Result`, exception channel, or unconstrained error type.
- A transform over success must preserve every failure variant unchanged unless
  the return type explicitly names a refined failure algebra.
- A fold must handle every state explicitly and return one declared target
  type. A catch-all branch defeats exhaustiveness.
- A zip or traversal must define failure accumulation or short-circuit behavior
  in its type and name. Do not leave the rule to callback order.
- A state transition should accept only its legal source state and return only
  its legal destination outcome.

Useful combinator names include `mapSuccess`, `fold`, `zip`, and `traverse` when
their behavior matches the local domain. Use domain language when the operation
is more specific than those mechanics.

## Review Questions

- Does the receiver truly own the operation?
- Can a callback perform an effect that the signature hides?
- Does adding a sealed subtype force every required mapping to change?
- Can composition discard a refined value or widen a finite failure into an
  arbitrary primitive?
- Are short-circuit, accumulation, and ordering semantics visible to callers?
