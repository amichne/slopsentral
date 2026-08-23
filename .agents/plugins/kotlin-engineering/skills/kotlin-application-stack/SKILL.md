---
name: "kotlin-application-stack"
description: "Use when Kotlin application work selects or integrates kotlinx.serialization, Ktor server or client, Clikt command hierarchies and completion, GraalVM native CLI delivery, or established domain libraries behind swappable module boundaries."
---

# Kotlin application stack

Use this skill for Kotlin library choices and their application bindings. Apply
`kotlin-code-correctness` for the domain model and acceptance standard. This
skill owns the dependency decision, adapter shape, and stack-specific proof.

## Operating contract

- Use the Kotlin standard library for ordinary collection, text, sequence, and
  value operations when it expresses the behavior directly.
- For a solved technical domain, inspect maintained libraries before writing a
  parser, protocol, HTTP layer, serializer, command framework, retry loop, or
  similar infrastructure. Prefer a library when its contract fits, it supports
  the target platform, and it reduces the code that the repository must own.
- Check the existing version catalog and dependency graph before adding another
  library that duplicates an installed capability.
- Keep domain contract and core modules pure. Their public cross-module APIs
  expose domain-owned values, capabilities, and finite failures.
- Put kotlinx.serialization, Ktor, Clikt, engines, SDKs, and other concrete
  bindings in focused adapter modules. Let one small application or integration
  module select the implementations and own their runtime configuration.
- Do not expose framework, transport, wire, engine, serializer, or SDK types
  through domain APIs. Only a framework extension whose callers intentionally
  program against that framework may expose its types. An application adapter
  does not qualify for this exception.
- Enforce the boundary with the repository's architecture checks. If none
  exist, add a focused Gradle or test gate that rejects adapter-library
  dependencies in pure modules and implementation types in their public APIs.
- Define focused ports around domain capabilities. Do not mirror a third-party
  API behind a second API with the same operations and types.
- Treat implementation replacement as a contract test. Swapping a binding
  should change the adapter and integration wiring, not the domain modules or
  their callers.
- Keep generic Git, CI, release, and Gradle execution ownership in their
  existing delivery and validation skills.

## Workflow

1. Inspect the module graph, version catalog, current libraries, and the nearest
   repository pattern. Identify the pure contract, pure core, adapter, and
   integration owners before changing dependencies.
2. Write the caller-facing domain types, capability interface, and finite
   failures. Confirm that no selected library type appears in that contract.
3. Compare the standard library, current dependencies, and established library
   candidates. Record why the selected choice fits maintenance, license,
   platform, runtime, native-image, and test constraints.
4. Implement the binding in the smallest adapter module. Keep parsing and
   projection at that edge. Expose a domain-owned factory or configuration when
   integration must construct it. If construction requires framework types,
   keep that construction inside the integration owner. Do not publish a
   framework-typed constructor across modules.
5. Load the reference for each stack branch used by the task. Do not load CLI
   or native-image guidance for an HTTP-only change.
6. Test pure behavior without a framework, then run the adapter's contract
   suite, the architecture boundary gate, and one integration proof through the
   real public entry point.
7. For a replaceable implementation, run the same contract suite against every
   supported binding. For a native CLI, also run the produced executable.

## Reference routing

- Read [kotlinx-serialization-and-ktor.md](references/kotlinx-serialization-and-ktor.md)
  when working with JSON, wire DTOs, a Ktor server, or a Ktor client.
- Read [clikt-cli-design.md](references/clikt-cli-design.md) when designing or
  changing a Clikt command hierarchy, options, defaults, help, completion, or
  CLI tests.
- Read [graalvm-native-cli.md](references/graalvm-native-cli.md) only when a
  CLI may benefit from a GraalVM native executable.

## Completion criteria

- The dependency choice has evidence. Custom infrastructure has an explicit
  reason when a standard or established library could have owned the problem.
- Pure modules do not depend on or expose the selected implementation library.
- A mechanical architecture or API check fails on implementation-type leakage.
- One integration owner selects concrete bindings.
- Public behavior, boundary failures, and replacement compatibility have
  focused tests.
- CLI work covers command help and completion. Native-image work includes a
  feasibility decision and a produced-binary smoke test.
