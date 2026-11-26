# Provenance

Reviewed 2026-09-16. Independently authored adaptation of
[new-silvermoon/awesome-android-agent-skills: gradle-build-performance](https://github.com/new-silvermoon/awesome-android-agent-skills/blob/82900eacc8dbe13de93c6310af27b9df4b2bd2f6/.github/skills/performance/gradle-build-performance/SKILL.md),
discovered through the user-supplied
[Skills listing](https://www.skills.sh/new-silvermoon/awesome-android-agent-skills/gradle-build-performance).
No upstream files, code examples, or templates are copied. Retain applicable
license and attribution notices if literal upstream material is imported later.

Retained: baseline-first diagnosis, configuration/execution separation, one change
per experiment, incremental compilation, processor cost, dependency resolution,
and cache investigation. Refined: structured Develocity API cohorts replace
visual-only confirmation; explicit scenario preparation replaces ambiguous clean
builds; version-supported flags replace fixed snippets. Excluded: universal hit
rate targets, guaranteed KSP speedups, assumed composite-build improvements,
warning-mode cache acceptance, and test/lint skipping as a performance shortcut.

The API collection and measurement procedures are local additions. Official
Gradle performance, Develocity API, Kotlin compilation/reporting, and
`gradle/actions` documentation were reviewed alongside the upstream skills.
Versioned API contracts and installed toolchain documentation remain authoritative.
The companion `github-ci-operations` owns Actions and records its own upstream
adaptation in its bundled provenance reference.
