# Engineering Design

Move information from weaker representations to stronger ones. Give domain
meaning a type, make invalid states unrepresentable where the language permits,
and preserve proven facts instead of converting them back to primitives.

Represent expected failure as a closed, typed set of outcomes. Fail closed on
unknown, ambiguous, unsupported, incomplete, or unproven input. Keep domain
logic deterministic; isolate I/O, mutation, time, randomness, and external
state behind explicit boundaries.

For structured data, define and validate a schema or typed parser at the trust
boundary. Require meaningful fields, close object shapes by default, use finite
variants for finite concepts, and construct a stronger internal value after
validation. Prefer compiler proof, then schema proof, then structured semantic
evidence, runtime observation, text, and finally heuristic inference.

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
