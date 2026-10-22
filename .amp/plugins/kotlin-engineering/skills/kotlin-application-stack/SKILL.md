---
name: kotlin-application-stack
description: "Use for Kotlin adapters with kotlinx.serialization, Ktor, Clikt, GraalVM, or OpenTelemetry, including coroutine ownership, Flow transport, and typed outcomes."
---

# Kotlin Application Stack

Keep domain contracts independent of frameworks. One integration owner selects
concrete adapters and their runtime configuration. Use `kotlin-design-practices`
for the domain model and API shape.

## Workflow

1. Inspect the module graph, version catalog, libraries, and existing adapter conventions.
   Name the pure contract, pure core, adapter, and integration owners.
2. Define the domain capability, constrained inputs, and finite outcomes.
   Keep framework, transport, engine, serializer, and SDK types outside domain APIs.
3. Compare the standard library, current dependencies, and established libraries.
   Record evidence for the selected maintenance, license, platform, runtime, and native-image constraints.
   Add custom infrastructure only when existing contracts cannot meet the need.
4. Implement one adapter path through the real public entry point.
   Keep wire parsing, serialization, telemetry, and framework construction with that adapter or its integration owner.
   Do not publish framework-typed constructors across domain modules.
5. Run pure behavior tests, the adapter contract suite, and the architecture gate.
   If no architecture gate exists, add a focused gate.
   Make sure that the gate rejects implementation dependencies and public implementation types in pure modules.
6. For replaceable bindings, run the same contract suite against each supported implementation.
   For a native CLI, also run the produced executable.
7. For telemetry, define operator questions and the minimum useful signals.
   Map every typed outcome through an exhaustive adapter.
   Examine exported telemetry for success, finite failures, retries, and unexpected faults.

## Adapter Rules

- Use the standard library when it expresses ordinary value and collection operations directly.
- Keep ports specific to domain capabilities. Do not duplicate a third-party API behind a second API with identical types.
- Keep one integration owner for concrete bindings.
  A replacement must preserve domain contracts and their callers.
- Only a framework extension whose callers intentionally use that framework can expose framework types.
  An application adapter does not meet that exception.
- Keep loggers, tracers, meters, clocks, and ambient context outside pure functions.
- Select OpenTelemetry attributes from the current Semantic Conventions registry.
  Prefer stable conventions. Record the owner of each experimental dependency.
- Keep span names and metric attributes bounded. Allowlist telemetry fields.
  Exclude secrets, credentials, tokens, request bodies, and unreviewed personal information.
- Distinguish expected domain failures from unexpected faults.
  A retry is not the terminal result. Preserve context across asynchronous and remote operations.
- Alert only on actionable user impact with an owner, threshold, duration, and diagnostic path.
- Keep generic Git, CI, release, and Gradle execution with their existing owners.
- Give each adapter scope, HTTP client, and Flow collector one explicit lifecycle owner.
  Preserve caller cancellation and release resources on failure and cancellation.
  Define retry, completion, buffering, and replay behavior before a concurrent adapter change.
- Use real components in tests. Prohibit mocks, spies, scripted stubs, and fake collaborators.
  Keep unit-test state local to each invocation. Use separate real-resource integration tests for external effects.
- Use `kotlin-design-practices` for detailed coroutine, Flow, and test-isolation guidance.

## Reference Routing

- For JSON, wire DTOs, or HTTP, read
  [serialization and Ktor](references/kotlinx-serialization-and-ktor.md).
- For command hierarchy, options, completion, or CLI tests, read
  [Clikt](references/clikt-cli-design.md).
- For native CLI feasibility or delivery, read
  [GraalVM](references/graalvm-native-cli.md).
- For operator questions, signals, outcome mappings, or telemetry tests, read
  [telemetry signals](references/telemetry-signals.md).
- For attribute names, placement, units, cardinality, or convention migration, read
  [Semantic Conventions](references/semantic-conventions.md).
- For telemetry source attribution, read [telemetry sources](references/telemetry-sources.md).

## Completion

Pure modules neither depend on nor expose implementation libraries.
The architecture gate rejects a deliberate implementation leak.
Focused tests cover public behavior, finite failures, and supported replacement contracts.
CLI evidence covers command help and completion. Native claims include a produced-binary smoke test.
Telemetry claims include exported data with bounded attributes and no sensitive fields.
Do not claim runtime behavior from compilation alone.
