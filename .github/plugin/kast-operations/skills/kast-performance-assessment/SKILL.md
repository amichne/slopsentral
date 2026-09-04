---
name: "kast-performance-assessment"
description: "Use when measuring Kast latency, CPU, allocation, indexing, graph, database, or agent-workflow overhead with cold and warm baselines, implemented telemetry, exact-process JFR, and repeatable comparisons; not for unmeasured optimization."
---

# Kast Performance Assessment

Measure a named workload against one exact root, release, backend, and source
revision. Treat configured instrumentation as unproven until its artifact grows.

## Workflow

1. Reproduce the symptom once and define the operation, input, success result,
   cold/warm state, and measurement boundary.
2. Capture exact-root readiness, Kast version, backend kind and PID, host/JDK,
   source revision, database generation, and existing instrumentation state.
3. Choose the lowest-cost evidence that can answer the question:
   wall/resource time, native graph measurements, Kast telemetry, structured
   trace, exact-process JFR, read-only SQLite plans, or timed Kast commands.
4. Run at least three comparable samples. Keep cold and warm results separate;
   report the sample count and the full distribution, not only the best run.
5. Change one factor at a time. Capture a new artifact segment rather than
   truncating a live log.
6. Restore every temporary workspace override and restart only the selected
   backend when required.
7. State what was observed, what is inferred, and what remains unmeasured.

## Instrumentation Truth

- Kast telemetry JSONL and structured IDEA trace are implemented evidence.
- External JFR is valid only after verifying the exact JVM PID and command line.
- `profiling.*` fields and hidden profile flags are configuration transport in
  the current tested release; no recorder or manifest consumer is proven. Do
  not advertise them as profiling evidence.
- For non-JVM or restricted environments, wall/resource time, native graph
  measurements, application telemetry, and query plans remain valid.

## Reference Routing

Read [measurement-runbook.md](references/measurement-runbook.md) for baseline,
telemetry, trace, JFR, database, structural-query, and restoration commands.

## Completion Criteria

- The exact workload and success invariant are recorded.
- Measurements identify root, release, backend/PID when present, source
  revision, warmth, sample count, and artifact paths.
- Any causal claim is supported by a changed factor and comparable evidence.
- Temporary configuration is restored, or the precise remaining override is
  reported.
