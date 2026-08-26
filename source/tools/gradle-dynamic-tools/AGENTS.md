# Gradle Dynamic Tools

This directory is a standalone Kotlin/JVM Gradle project. Use its checked-in wrapper for focused
checks.

- Keep domain types under `domain`; do not expose Tooling API, JDI, persistence, or serialization
  types across their adapter boundaries.
- Keep all dynamic-tool request objects closed and discriminated by `type`. Their authored schemas
  live under `source/schemas/gradle-dynamic-tools`.
- Execute only the admitted repository `gradlew` path through `ProcessBuilder`; do not add a shell
  boundary.
- Preserve one active run per repository with `.gradle/codex-dynamic-tools/active.lock` and write
  summaries atomically under `.gradle/codex-dynamic-tools/runs`.
- JDWP launch is valid only for filtered test operations. Gradle's `--debug-jvm` contract fixes the
  current endpoint at `127.0.0.1:5005`.

Run `./gradlew test` after Kotlin changes and validate the matching schema hierarchy after contract
changes.
