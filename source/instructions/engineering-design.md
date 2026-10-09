# Engineering Excellence

Move information from weaker representations to stronger ones. Give domain
meaning a type, make invalid states unrepresentable where the language permits,
and preserve proven facts instead of converting them back to primitives.

Treat the type system as durable memory. Every fact a downstream consumer
requires must survive in its input contract. Prefer a representation that
structurally excludes invalid values and combinations. A name, type alias,
unchecked wrapper, Boolean validation result, or prior branch is insufficient.
Keep unchecked construction private and require the stronger value at every
consumer. Primitive extraction belongs in explicit serialization and effect
adapters, not application APIs. Do not repeat discharged input checks deep in
application layers or bypass rejection with casts, assertions, nullable
sentinels, default branches, or exception-backed expected failures.
Output adapters implement shared serialization abstractions; domain values do
not own encoding methods or choose their output format.

Represent expected failure as a closed, typed set of outcomes. Fail closed on
unknown, ambiguous, unsupported, incomplete, or unproven input. Keep domain
logic deterministic; isolate I/O, mutation, time, randomness, and external
state behind explicit boundaries.

Put each invariant with the type or module that owns it. Each legal transition
accepts its source-state representation and returns its destination state or a
closed failure. Case-specific facts and operations belong to that case. Effects
can establish new facts or fail; represent those outcomes explicitly. Scope
volatile evidence to the resource, version, and lifetime it establishes.

For structured data, define and validate a schema or typed parser at the trust
boundary. Require meaningful fields, close object shapes by default, use finite
variants for finite concepts, and construct a stronger internal value after
validation. Prefer compiler proof, then schema proof, then structured semantic
evidence, runtime observation, text, and finally heuristic inference.

Use Semantic Ratchet for proof-preserving design and review. Its bundled
references explain the rationale and Kotlin, API, and shell realizations.
Compiler rejection proves only the encoded obligation; encapsulated parsers,
schemas, and effect transitions need their own focused evidence. Do not claim
linear consumption, current authorization, external agreement, or complete
runtime correctness from an ordinary type alone.

Completion needs a focused executable check that proves the changed invariant.
When an opaque effect boundary causes investigation, add bounded structured
outcome evidence there without recording secrets or unbounded payloads.

Before implementing a proposed concept, check current owners, contracts, callers,
and tests. Treat plans and incident explanations as hypotheses. Choose reuse,
extend, add, or investigate from source evidence; an unknown state does not
justify a duplicate owner. Use the `tdd` codebase preflight for behavior work.
Build only the unmet requirement. Preserve flexibility through small cohesive
boundaries; add abstractions for current invariants or consumers, not imagined
future variants. Verified reuse is a successful outcome.
