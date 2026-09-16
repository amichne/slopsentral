---
name: intellij-platform-integrations
description: Use when implementing or debugging IntelliJ Platform run configuration types, factories, settings editors, execution state, process handlers, producers, or External System project import and task execution.
---

# IntelliJ Platform Integrations

Determine whether the feature is an Execution API run configuration or an
External System project-model integration. They can meet at task execution but
have different persisted identities, lifecycles, and tests.

## Workflow

1. Inspect the resolved SDK, repository descriptor, existing extension points,
   persisted state, and tests. Do not invent extension IDs from memory.
2. For run configurations, model type/factory identity, configuration state,
   settings validation and editor reset/apply, execution environment, and the
   process lifecycle separately.
3. For External System, keep external project identity stable, translate the
   imported model to IntelliJ project data, reconcile changes idempotently, and
   route tasks through the external-system execution boundary.
4. Keep discovery/parsing pure where possible and apply project-model mutation
   through platform-owned services and write boundaries.
5. Prove serialization round trips, import/reimport/removal, cancellation,
   error mapping, task execution, and disposal with the narrowest fixture.

Read [run-and-external-system.md](references/run-and-external-system.md) for
the actionable contracts.
