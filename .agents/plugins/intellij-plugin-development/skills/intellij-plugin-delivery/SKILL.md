---
name: intellij-plugin-delivery
description: "Use for IntelliJ plugin descriptors, service lifecycles, run configurations, External System integration, packaging, Plugin Verifier, installation, and authorized publication."
---

# IntelliJ Plugin Delivery

Use the existing plugin architecture and publication authority.
Keep pinned Platform, Gradle, Kotlin, and JDK versions unless the task changes them.

## Workflow

1. Read repository instructions and inspect Git status. Preserve unrelated work.
2. Inspect the wrapper, build scripts, catalog, `plugin.xml`, module graph, tests, and release workflows.
   Use resolved SDK contracts for extension IDs and lifecycle decisions.
3. Identify the descriptor, service, run configuration, External System, or artifact that owns the change.
   Use `intellij-psi-indexing` for PSI and indexes.
   Use `intellij-platform-testing` for fixtures, UI automation, and live IDE diagnosis.
4. Keep extension instances stateless. Put state and lifetime in services.
   Preserve disposal, cancellation, coroutine lifetime, and dynamic-unload contracts.
5. For run configurations, separate type/factory identity, persisted state, editor behavior, execution environment, and the process lifecycle.
   Preserve settings rejection and editor reset/apply behavior.
   Reuse equivalent configurations through semantic context comparison.
6. For External System, keep project identity stable.
   Separate external model acquisition, pure translation, and mutation through Platform services.
   Reconcile imports idempotently without deletion of another integration's state.
   Use External System task APIs for task execution.
7. Run focused tests for the changed contract.
   Cover serialization, invalid settings, import/reimport/removal, task execution, cancellation, failure mapping, and disposal when the change reaches them.
8. Expand to packaging, Plugin Verifier, sandbox execution, or CI only when the changed surface needs that evidence.
9. Use repository-owned installation and authorized publication paths.
   Examine the running IDE's artifact identity before an installed-behavior claim.
   A ZIP build, sandbox result, and publication result establish different facts.

Use `kotlin-design-practices` for Kotlin contracts. Read `kotlin-gradle-validation`
only when the user explicitly selects it. Use necessary Gradle commands directly otherwise.
Use `tdd` for focused acceptance proof. Keep Git, CI, and
pull-request operations with their existing workflow owners.

## Reference Routing

- For descriptors, dependencies, services, coroutines, disposal, or dynamic unload,
  read [Platform contracts](references/platform-contracts.md).
- For run configuration factories, editors, producers, execution state, or external imports,
  read [run configurations and External System](references/run-and-external-system.md).
- For compatibility, Plugin Verifier, sandboxes, archives, or publication,
  read [build and verification](references/build-and-verification.md).
- For source attribution or upstream reconciliation, read [sources](references/sources.md).

## Completion

The change obeys pinned Platform contracts. Focused tests cover changed lifecycle
and integration behavior. Packaging, compatibility, installed behavior, and
publication claims each have their own evidence. Report readiness, restart,
compatibility, or publication blockers without an unsupported fallback.
