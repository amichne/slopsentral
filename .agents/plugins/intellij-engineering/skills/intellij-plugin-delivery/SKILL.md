---
name: "intellij-plugin-delivery"
description: "Use when developing, verifying, packaging, or delivering an existing IntelliJ Platform plugin through plugin.xml, services, lifecycle, Gradle, Plugin Verifier, sandboxes, archives, signing, or publication boundaries."
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
3. Keep this skill at the descriptor, service lifecycle, build compatibility,
   verifier, packaging, runtime installation, and publication boundary. Route
   PSI/indexing, testing, diagnostics, or integrations to their focused skills.
4. Fix the owning boundary. Keep extension instances stateless, put state and
   lifetime in services, and preserve disposal and dynamic-unload contracts.
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
  `plugin.xml`, dependencies, services, extension lifecycles, coroutines,
  disposal, cancellation, or dynamic unload.
- Read [build-and-verification.md](references/build-and-verification.md) for
  Gradle Plugin 2.x configuration, platform/JDK compatibility, focused tests,
  Plugin Verifier, sandbox runs, packaging, signing, or publication boundaries.
- Read [sources.md](references/sources.md) when updating this skill, checking
  provenance, or reconciling its guidance with upstream material.

## Completion Criteria

- The change follows the repository's pinned platform and ownership contracts.
- IntelliJ lifecycle, disposal, and dynamic-unload risks affected by the
  change have focused evidence.
- The narrowest relevant test succeeds, and broader packaging, verifier,
  runtime, or delivery claims have their own successful proof.
- Remaining typed readiness, compatibility, restart, or publication blockers
  are reported without unsupported fallback.
