# Engineering Baseline

Refine; never erase. Decompose each requirement into an invariant, its owner,
construction boundary, legal transitions, closed failures, and decisive check.
Inspect existing contracts and callers before adding a representation. Carry
established facts in consumer types; aliases, names, prior guards, flags, and
unchecked wrappers do not establish a proof.

Keep primitives at ingress and serialization boundaries. Parse external values
once into constrained values or case-specific immutable variants. Close finite
state and failure spaces, keep constructors under the invariant owner, and make
illegal combinations absent from public APIs. Fail early on unknown, ambiguous,
unsupported, incomplete, or unproven states. Preserve evidence identity, version,
and lifetime; ordinary types cannot prove freshness or single consumption.

Keep the core deterministic and pure. Pass filesystem, process, network, clock,
randomness, and mutable state through explicit outer capabilities. Functions
belong to the smallest semantic owner. Use higher-order functions when they
compose a real operation: map preserves every failure, fold handles every case,
and traversal declares order and short-circuit or accumulation semantics.
Closures may capture immutable refined values; they must not hide effects,
mutable ambient state, resource lifetimes, or deferred failure channels.

Expected failures are finite domain data. For each fallible effect, enumerate
which invariant could not be established and translate documented exceptions
once at that adapter into case-specific outcomes. Do not use exceptions as a
second domain control flow or catch all defects and label them success. Unknown
adapter failures stop the operation with bounded stage evidence. Preserve
cancellation and interruption; do not invent rollback or successful completion.

Use the strongest available authority: compiler, schema, structured semantic
evidence, runtime observation, text, then heuristics. Prove accepted behavior and
named forbidden calls or transitions. Exhaustive handling must fail when a new
case is added. Do not bypass errors with casts, blanket ignores, catch-all
branches, nullable sentinels, or weaker types. Test expectations independently
of implementation. Add bounded stage/outcome instrumentation while investigating
opaque effects, without secrets, source payloads, or unbounded output.

Default new automation to Python managed by required uv. Use PEP 723 for portable
scripts, declared dependencies and indexes, committed locks, and
`[tool.uv] no-build = true`. Use strict Pyright for static checking and its LSP
for symbol-aware navigation/refactors when available; run Ruff formatting and
linting plus pytest success, failure, and boundary checks. Do not claim Python
proves purity, sealed construction, or linearity: enforce the remaining limits
with encapsulation and executable tests. Shell is limited to unavoidable host
launchers; parsing, branching, pipelines, setup, and cleanup belong in Python.
Existing language toolchains remain authoritative for their code.

Use Semantic Ratchet for invariant and API design, Python Tooling for automation,
and language/domain specialties for concrete syntax and local verification.
Complete the smallest useful implementation and the repository's required
checks. Retain useful existing contracts; remove redundant owners and paths.
