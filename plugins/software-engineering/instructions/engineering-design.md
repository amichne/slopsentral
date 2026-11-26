# Engineering Baseline

## Select the existing contract

Start with the requested action and the implementation that owns it. For a
review, assess the existing contract and evidence. For a change, reuse or extend
that owner when it meets the outcome; introduce a new owner only when the
required contract has none.

Refine; never erase. Decompose each requirement into an invariant, its owner,
construction boundary, legal transitions, closed failures, and decisive check.
Inspect existing contracts and callers before adding a representation. Carry
established facts in consumer types; aliases, names, prior guards, flags, and
unchecked wrappers do not establish a proof.

## When values or state cross a boundary

Keep primitives at ingress and serialization boundaries. Parse external values
once into constrained values or case-specific immutable variants. Close finite
state and failure spaces, keep constructors under the invariant owner, and make
illegal combinations absent from public APIs. Fail early on unknown, ambiguous,
unsupported, incomplete, or unproven states. Preserve evidence identity, version,
and lifetime; ordinary types cannot prove freshness or single consumption.

## When composing decisions and effects

Keep the core deterministic and pure. Pass filesystem, process, network, clock,
randomness, and mutable state through explicit outer capabilities. Functions
belong to the smallest semantic owner. Use higher-order functions when they
compose a real operation: map preserves every failure, fold handles every case,
and traversal declares order and short-circuit or accumulation semantics.
Closures may capture immutable refined values; they must not hide effects,
mutable ambient state, resource lifetimes, or deferred failure channels.

## When an operation can fail

Expected failures are finite domain data. For each fallible effect, enumerate
which invariant could not be established and translate documented exceptions
once at that adapter into case-specific outcomes. Do not use exceptions as a
second domain control flow or catch all defects and label them success. Unknown
adapter failures stop the operation with bounded stage evidence. Preserve
cancellation and interruption; do not invent rollback or successful completion.

## When changing structure or proving behavior

Use Directory Design when a change introduces a directory, a group of prefixed
names, or a new path to an existing concept.

Use the strongest available authority: compiler, schema, structured semantic
evidence, runtime observation, text, then heuristics. Prove accepted behavior and
named forbidden calls or transitions. Exhaustive handling must fail when a new
case is added. Do not bypass errors with casts, blanket ignores, catch-all
branches, nullable sentinels, or weaker types. Test expectations independently
of implementation. Add bounded stage/outcome instrumentation while investigating
opaque effects, without secrets, source payloads, or unbounded output.

## When writing or changing automation

Inspect the existing automation owner and its invocation path first, and extend
a suitable owner. Read Python Tooling before changing portable command packaging,
dependencies, or execution. Scaffold a project only when the requested outcome
requires one and no existing owner fits.

- Write standalone commands, setup, process calls, decisions, cleanup, and CI
  orchestration in Python; prefer the standard library for small commands. Keep
  shell only for an existing host interface that needs it, and use the host
  language for an adapter on a native API. Existing language toolchains remain
  authoritative for their code.
- For distributed tools, keep dependency locks, use the available uv, and declare
  a minimum version only when a required feature establishes one. Keep exact
  development or CI pins in maintainer tooling. Set `no-build = true` in `uv.toml`.
- Give a script that runs outside a checkout a PEP 723 header with its Python
  range, direct dependencies (`dependencies = []` for the standard library), and
  index. Commit its adjacent lock and run it with `uv run --locked --script`.
- Give public commands executable names without extensions, on `PATH`. Keep
  runtime dependencies small.
- Check with strict Pyright (its LSP for navigation when available), Ruff, and
  pytest for accepted inputs, rejected inputs, and limits. Use encapsulation and
  executable tests for purity, construction, and single use.

Use Semantic Ratchet for invariant and API design and language or domain
specialties for concrete syntax and local verification.
Complete the smallest useful implementation and the repository's required
checks. Keep useful existing contracts; remove redundant owners and paths.

## When retrieving or maintaining system knowledge

For a bounded source question, retrieve the explanation and evidence needed to
answer it. After a source change, review affected claims.

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
When adopting portable knowledge support, use Code Knowledge Base, then prove
the packaged runtime in an independent project.
