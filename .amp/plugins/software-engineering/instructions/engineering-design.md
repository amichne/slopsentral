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

Use Python for standalone commands and CI orchestration.
Prefer the standard library for small commands.
Use the host language for an adapter that depends on a native API.
Install uv through mise and pin its version in the project's `mise.toml`.
Give public commands executable names without file extensions. Put them on `PATH`.
Use `uv.toml` for checkout configuration. Set `no-build = true`.
Use PEP 723 for a script that needs to run outside a checkout.
Declare the Python range, direct dependencies, and index in the script header.
Use `dependencies = []` for standard-library scripts.
Keep Python dependency lockfiles out of Git. Keep runtime dependencies small.
Use strict Pyright. Use its LSP for symbol navigation when available. Use Ruff for format and lint checks.
Use pytest for accepted inputs, rejected inputs, and limits. Use encapsulation and executable tests for purity, construction, and single use.
Use Python for setup, process calls, decisions, and cleanup. Keep shell adapters only for an existing host interface
that needs shell code. Keep its automation in Python.
Existing language toolchains remain authoritative for their code.

Use Semantic Ratchet for invariant and API design, Python Tooling for automation,
and language/domain specialties for concrete syntax and local verification.
Complete the smallest useful implementation and the repository's required
checks. Keep useful existing contracts; remove redundant owners and paths.


Update explanations that a behavior change makes inaccurate. Use the owning
implementation and executable evidence to support each changed claim.
Keep current behavior, decisions, historical results, and unknowns distinct.

Use the repository's existing OKF owner for maintained system knowledge. Keep
concepts atomic, source citations explicit, and conceptual links useful. Use
versioned evidence and impact checks to find stale explanations. Reject missing
sources and incomplete coverage rather than reporting no drift. A matching digest
proves byte agreement, not semantic accuracy or reader comprehension. Preserve
OpenWiki's native Claims and finalization when it owns the store. Ordinary code
work needs focused retrieval and impact review, not automatic wiki generation.
Dogfood the same distributed procedures and runtime that other projects use.
Keep project roots, backend selection, and fingerprint exceptions in configuration.
Use Code Knowledge Base for portable adoption, then prove the packaged runtime in an independent project.
