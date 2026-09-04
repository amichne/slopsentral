---
name: "kotlin-observability-design"
description: "Use when designing or reviewing Kotlin logging, metrics, tracing, OpenTelemetry attributes, alerting, or telemetry verification while preserving pure core logic and closed typed outcomes."
---

# Kotlin Observability Design

Make production behavior answerable without letting telemetry effects or
vendor types enter the domain core. Core Kotlin returns proof-carrying values
and closed outcomes; an explicit adapter maps those values to logs, metrics,
spans, and alerts.

## Operating Contract

- Start with concrete operator questions. A signal that answers no question is
  noise.
- Keep emission at effect boundaries. Do not inject loggers, tracers, meters,
  clocks, or ambient context into pure domain functions.
- Map typed outcomes to telemetry with a total, exhaustive transformation.
  Stable domain variants become stable telemetry classifications; expected
  failure does not become an exception protocol.
- Choose OpenTelemetry names from the current Semantic Conventions registry
  before defining custom attributes. Prefer stable conventions and record any
  experimental dependency.
- Keep span names and metric attributes bounded. Put high-cardinality detail in
  spans or structured logs only when policy permits it.
- Allowlist telemetry fields. Never emit secrets, credentials, tokens, request
  bodies, or unreviewed personally identifiable information.
- Treat telemetry as executable behavior: trigger the path and verify the
  exported shape before claiming observability exists.

## Workflow

1. Write two to four questions an operator must answer about the feature,
   failure, dependency, or state transition.
2. Identify the typed success and finite failure variants at the domain-to-effect
   boundary.
3. Choose the minimum signal set: metric for aggregate detection, trace for
   localization, structured log for event-specific explanation, and alert only
   for actionable user impact.
4. Define a total outcome-to-telemetry mapping and select attributes through
   the current OpenTelemetry registry.
5. Implement instrumentation in adapters or orchestration code, preserving
   context across asynchronous and remote boundaries.
6. Exercise success, each expected failure class, retry or fallback behavior,
   and unexpected faults; inspect the emitted telemetry and cardinality.

## Reference Routing

- Read [signals-and-boundaries.md](references/signals-and-boundaries.md) for
  signal selection, typed-outcome mapping, structured logging, RED/USE metrics,
  tracing, alerting, or verification.
- Read [semantic-conventions.md](references/semantic-conventions.md) for
  OpenTelemetry attribute selection, placement, stability, namespacing,
  cardinality, and migration decisions.
- Read [sources.md](references/sources.md) when updating this skill or auditing
  the upstream provenance and excluded vendor-specific material.

## Completion Criteria

- Every emitted signal answers a named operator question.
- Domain logic remains deterministic and free of telemetry effects.
- Every caller-visible outcome has an explicit telemetry decision.
- Attribute names, placement, stability, units, and cardinality follow current
  OpenTelemetry authority or carry a documented custom decision.
- Sensitive fields are excluded by construction or allowlist.
- Success, expected failure, and unexpected-fault telemetry were observed in a
  focused test or controlled environment.
