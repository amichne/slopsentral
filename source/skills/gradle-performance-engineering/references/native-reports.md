# Native Build Evidence

Use the existing Gradle wrapper and reports supported by the repository's pinned
Gradle and Kotlin versions. Preserve current build settings unless the requested
experiment needs a reviewed change. Do not add a hosted reporting service.

## Collection

1. Record source SHA, exact wrapper invocation, JDK, Gradle/Kotlin versions,
   task set, cache preparation, daemon state, host resources, and repetition.
   In CI also retain run ID, attempt, job, and matrix identity.
2. Keep invocation start/end times and exit status together. Failed or canceled
   builds remain in reliability totals but do not enter successful timing cohorts.
3. Use native Gradle profiling reports when supported. `--profile` is an explicit
   experiment flag; retain its report from that invocation. Summed parallel task
   durations are work, not elapsed time or a measured critical path.
4. Read version-supported Kotlin build reports for compiler mode, nonincremental
   reasons, processing cost, and known timings. Retain original files separately
   from derived metrics. Do not manufacture absent fields.
5. Keep JUnit XML and required output artifacts as correctness evidence. A faster
   command with tests omitted is a different workload and cannot prove improvement.
6. Verify report identity and units before aggregation. Distinguish complete,
   missing, unsupported-format, truncated, and identity-unresolved evidence.
   Only complete, comparable samples enter the acceptance cohort.

Report unavailable metrics explicitly. Native reports may not expose exact
critical paths, cache eligibility, resource peaks, or dependency bytes. Narrow the
claim or report evidence unavailable when those fields are necessary.

Sources: [Gradle profiling](https://docs.gradle.org/current/userguide/performance.html)
and [Kotlin reports](https://kotlinlang.org/docs/gradle-compilation-and-caches.html).
Use documentation matching the repository's pinned versions.
