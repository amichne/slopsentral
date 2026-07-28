---
name: "intellij-plugin-delivery"
description: "Develop, debug, verify, package, and deliver existing IntelliJ Platform plugins. Use for plugin.xml, IntelliJ Platform Gradle Plugin 2.x, services, extensions, coroutines, disposal, PSI, indexes, dumb mode, Plugin Verifier, Starter/Driver UI automation, testIdeUi, dynamic unload, IDE sandboxes, or Kast's IDEA backend and exact-root workflow."
---

# IntelliJ Plugin Delivery

Use the repository's existing plugin architecture and delivery authority. Do
not scaffold over an established project or replace pinned platform, Gradle,
Kotlin, or JDK versions merely because newer versions exist.

## Workflow

1. Read the nearest repository instructions and inspect Git status before
   changing anything. Treat unrelated changes as user work.
2. Discover the current plugin contract from the wrapper, settings and build
   scripts, version catalog, `plugin.xml`, module dependencies, tests, and
   release workflows.
3. Classify the change as descriptor/dependency, service/lifecycle,
   PSI/indexing, UI/action, UI integration test, build compatibility, runtime
   installation, or delivery work. Load only the matching reference below.
4. Fix the owning boundary. Keep extension instances stateless, put state and
   lifetime in services, respect read/write and dumb-mode rules, and validate
   resolved PSI types before language-specific access.
5. Use focused TDD and Gradle evidence. Broaden from the affected test or task
   to plugin packaging, compatibility verification, sandbox execution, or CI
   only when the changed surface requires it.
6. Follow repository-owned installation and publication paths. A successful
   ZIP build is not proof that a running IDE uses it, and a local sandbox is not
   publication proof.

Use `kotlin-agentic-correctness`, `kotlin-gradle-validation`, `tdd`,
`git-change-flow`, `github-ci-operations`, and `pull-request-lifecycle` when
they are installed; this skill owns the IntelliJ-specific decisions.

## Reference Routing

- Read [platform-contracts.md](references/platform-contracts.md) for
  `plugin.xml`, dependencies, services, extension lifecycles, threading,
  coroutines, PSI/indexing, dumb mode, cancellation, or dynamic unload.
- Read [build-and-verification.md](references/build-and-verification.md) for
  Gradle Plugin 2.x configuration, platform/JDK compatibility, focused tests,
  Plugin Verifier, sandbox runs, packaging, signing, or publication boundaries.
- Read [ui-automation.md](references/ui-automation.md) for programmatic UI
  tests using JetBrains Starter, Driver, `testIdeUi`, semantic component
  queries, IDE lifecycle, and test artifacts.
- Read [kast-delivery.md](references/kast-delivery.md) only when the target
  repository is Kast or uses Kast's exact-root IDEA backend lifecycle.
- Read [sources.md](references/sources.md) when updating this skill, checking
  provenance, or reconciling its guidance with upstream material.

## Completion Criteria

- The change follows the repository's pinned platform and ownership contracts.
- IntelliJ threading, PSI, disposal, and dynamic-unload risks affected by the
  change have focused evidence.
- The narrowest relevant test succeeds, and broader packaging, verifier,
  runtime, or delivery claims have their own successful proof.
- UI claims, when in scope, come from an isolated programmatic test with
  semantic assertions and retained failure artifacts.
- Remaining typed readiness, compatibility, restart, or publication blockers
  are reported without unsupported fallback.
