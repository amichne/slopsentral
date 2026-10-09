# Runtime Performance Proof

Name the measured dimension before changing code: transport latency, total
latency, semantic work, allocations, throughput, or build time. A faster wrapper
does not prove less native work. Keep Gradle build experiments with
gradle-performance-engineering and IDE capture with ide-diagnostics-mcp.

Pin baseline and candidate source revisions, installed artifact identities,
client/IDE builds, model or runner configuration, and environment. Compare the
same semantic queries, inputs, result obligations, coverage, pagination, and
continuations. Retain rejected, timed-out, stale, and unmatched attempts. A
comparison with missing or unequal workload proof is incomplete.

Separate cold setup, warm execution, transport, and semantic stages. Keep sample
counts, distributions, order, and cache state visible. Use existing replay and
stage reports instead of a parallel benchmark framework. Confirm output and
coverage equivalence before aggregating paired timings. Inspect a bounded live
sample when the claim crosses the installed process boundary.

Record the requested scope, underlying search universe, visited candidates,
confirmed results, preparation calls, bytes read, and retained objects where
the boundary exposes them. An exact-name filter can still enumerate a broad
universe to prove completeness. Fewer returned rows do not establish less search.
Counters in a controlled production-rule fixture prove work at that boundary;
they do not establish native latency, target-scale behavior, or agent usability.

Keep semantic work limits and elapsed budgets separate from host wall-clock
containment and transport timeouts. Observe submission, acquisition, first
callback, extraction, cancellation request, native drain, and resource release
where available. Caller completion is not evidence that native work stopped.
Retain cancelled and unfinished phases explicitly; late completion must not
rewrite a sealed result. Instrument the phase consuming the limit before
increasing it, and report unavailable phase observations rather than inventing
timing attribution.

When the original environment is inaccessible or private, use a public surrogate
that preserves the suspected mechanism, production boundary, and pathological
scaling. Freeze fixture, oracle, source identities, and resource grants; compare
old and candidate work counts with a negative control while retaining answer,
completeness, freshness, and cancellation invariants. Add a small public native
integration layer when the claim needs it. This can qualify removal of the
represented pathology class without replaying the original incident; it does
not identify that incident's exact cause or establish its latency. Injected
delays can exercise lifecycle behavior, but cannot substantiate a performance
improvement.

Report each supported dimension with its measured units and exact revisions.
Retain a negative signal such as `lessWork=false`; it prohibits a reduced-work
claim even when equivalent queries are faster. Missing installed equivalence,
coverage, or sample evidence must stay explicit in the handoff.

Public source examples: [Kast #966](https://github.com/amichne/kast/pull/966)
uses production-rule capture counters; [#963](https://github.com/amichne/kast/pull/963)
explains broad completeness scans; [#964](https://github.com/amichne/kast/pull/964)
separates first-callback delay and read drainage. The latter two were open at
source review; their descriptions and tests are evidence of proposed boundaries,
not installed performance qualification.
