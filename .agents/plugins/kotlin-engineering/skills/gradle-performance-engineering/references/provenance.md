# Provenance

Reviewed 2026-09-16. Independently authored adaptation of
new-silvermoon/awesome-android-agent-skills: gradle-build-performance,
The reviewed source remains the attribution record.
No upstream files, code examples, or templates are copied. Retain applicable
license and attribution notices if literal upstream material is imported later.

Retained: baseline-first diagnosis, configuration/execution separation, one change
per experiment, incremental compilation, processor cost, dependency resolution,
and cache investigation. Refined: native Gradle/Kotlin reports replace visual-only confirmation; explicit scenario preparation replaces ambiguous clean
builds; version-supported flags replace fixed snippets. Excluded: universal hit
rate targets, guaranteed KSP speedups, assumed composite-build improvements,
warning-mode cache acceptance, and test/lint skipping as a performance shortcut.

The report collection and measurement procedures are local additions. Official
Gradle performance, Kotlin compilation/reporting, and
`gradle/actions` documentation were reviewed alongside the upstream skills.
Versioned report contracts and installed toolchain documentation remain authoritative.
The companion `github-ci-operations` owns Actions and records its own upstream
adaptation in its bundled provenance reference.
