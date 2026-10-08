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

Report each supported dimension with its measured units and exact revisions.
Retain a negative signal such as `lessWork=false`; it prohibits a reduced-work
claim even when equivalent queries are faster. Missing installed equivalence,
coverage, or sample evidence must stay explicit in the handoff.
