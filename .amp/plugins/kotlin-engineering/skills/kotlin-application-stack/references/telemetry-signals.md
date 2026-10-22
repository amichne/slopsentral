# Signals And Effect Boundaries

Use this reference to decide what to emit and where the emission belongs.

## Start With Questions

Write the operator questions before choosing libraries or signals. Useful
questions distinguish success from each finite failure, locate latency, expose
retry or fallback behavior, and show whether user impact crosses an agreed
threshold.

| Signal | Primary question | Constraint |
| --- | --- | --- |
| Metric | How often, how much, or how long in aggregate? | Dimensions must be bounded |
| Trace | Where did time or control flow go across boundaries? | Span names must be bounded; context must propagate |
| Structured log | What happened in this specific event? | Stable event name, allowlisted fields, trace correlation |
| Alert | Is actionable user impact occurring now? | Threshold, duration, owner, and runbook must be justified |

Use the smallest set that answers the questions. More events do not create more
observability when they cannot be queried coherently.

## Typed Outcome Boundary

Pure domain code returns a closed outcome. The application or adapter layer
performs one exhaustive mapping from that outcome to telemetry and the external
protocol response.

- A successful outcome records the relevant duration and stable success class.
- Each expected failure variant receives an explicit operational class. Routine
  rejection may be useful for a metric or structured event without being an
  exception or an error span.
- A retry attempt is not the final operation outcome. Record bounded attempt
  information, then classify the enclosing operation from its terminal result.
- An unexpected thrown fault is distinct from finite domain failure. Record it
  at the effect boundary, preserve trace context, and follow the platform's
  exceptional-failure contract.
- Do not use exception messages, class names, or arbitrary strings as the
  canonical domain failure taxonomy. Map from the sealed domain variant to a
  stable telemetry value.

The mapping should be total. Adding a domain outcome must make the adapter fail
to compile until its telemetry and protocol behavior are chosen.

## Logs

Emit structured events with stable names and typed fields rather than prose
assembled by interpolation. Choose severity from operational meaning:

- error: an unexpected fault or broken invariant requiring investigation;
- warning: a handled degradation worth trending;
- information: a significant lifecycle or business event;
- debug: bounded diagnostic detail normally disabled in production.

Use standard trace correlation when a span is active. Add a separate request or
correlation identifier only when the system contract needs one; do not create a
second competing trace identity.

## Metrics

Use RED for request or dependency boundaries: rate, terminal error class, and
duration. Use USE for finite resources: utilization, saturation, and errors.
Represent latency with a histogram and query distributions rather than relying
on averages.

Metric attributes must come from small, reviewable sets such as route template,
operation, outcome class, status class, or provider. User identifiers, raw
paths, request identifiers, exception messages, and other unbounded values do
not belong in metric dimensions.

## Traces

Use automatic instrumentation for standard transports when it satisfies the
repository contract. Add manual spans around meaningful effectful operations,
not every pure function. Propagate context through HTTP, messaging, coroutines,
and scheduled work using the established integration rather than ambient
thread assumptions.

Span status describes the terminal operation. A handled rejection, successful
fallback, or eventually successful retry is not automatically an error span.

## Alerts And Verification

Alert on symptoms users experience. Every alert needs an actionable condition,
an owner, a justified threshold and duration, and a runbook or first diagnostic
query.

Verify instrumentation by exercising controlled paths and inspecting actual
output:

- success and every finite expected failure map to the intended stable class;
- an induced unexpected fault is correlated across trace and log records;
- metric units and dimensions are correct and bounded;
- one request or message crosses all intended trace boundaries;
- sensitive inputs remain absent;
- each alert reaches the intended destination in an authorized test context.
