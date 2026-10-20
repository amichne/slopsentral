# Evidence-Triggered Gradle Changes

Select one intervention from measured cost and verify its predicted outcome.
Check feature support against the repository's actual toolchain before using
properties from current documentation.

| Evidence | Candidate intervention | Required verification |
| --- | --- | --- |
| Configuration dominates or reuse is invalidated | Fix invalidation causes and incompatible plugins/tasks; use provider-backed inputs and lazy registration/configuration | Configuration-cache store and subsequent reuse; no configuration problems; same task outputs |
| Eager configuration or configuration-time I/O dominates | `tasks.register`, `configureEach`, tracked Providers/ValueSources; move execution work into tasks | Lower configuration cost without untracked environment/file inputs |
| Repeated cacheable work executes | Compare input fingerprints, toolchains, cache policy, and miss reasons; fix determinism and correctly declared inputs/outputs | Equivalent clean outputs and restored outputs across distinct workspaces; observed cache eligibility and reuse |
| Cache downloads cost more than execution | Measure transfer/restore/save cost; narrow or disable the expensive layer for that workload | Better job elapsed time and consumption including post-job cache work |
| Compilation is nonincremental | Inspect Kotlin report reasons, ABI changes, compiler/plugin versions, generated source churn, and processor behavior | Same implementation-edit scenario becomes incremental; ABI-edit consumers still rebuild correctly |
| kapt/KSP dominates | Inspect per-processor cost and incremental support; consider KSP only for compatible processors and generated APIs | Generated sources/API and tests equivalent; measured processing and total build deltas; no fixed speed multiplier |
| Dependency resolution dominates | Use stable versions/locking and correct repository content filters; remove redundant lookups after inspection | Same resolved artifacts; observed download/resolution decrease; cold dependency resolution still works |
| GC or memory pressure dominates | Tune Gradle/Kotlin daemon and test-fork heaps within total runner memory; adjust worker count | Lower GC/wall time without OOM, swapping, daemon churn, or higher failure rate |
| CPU idle with independent ready work | Test parallel execution and bounded worker/test-fork concurrency | Shorter critical path within CPU/memory limits and unchanged correctness |
| Serial heavy modules dominate | Investigate dependency edges, unnecessary API exposure, plugin cost, and module boundaries | Real consumer closure preserved; representative edit scenarios improve |

Configuration cache reuses configuration; build cache reuses task outputs;
GitHub Actions caches transport files between runners. Keep all three explicit.
Do not accept `configuration-cache.problems=warn` as completion: fix compatibility
and retain failure on unsupported access. Do not annotate a task cacheable or
weaken path sensitivity merely to improve a ratio; prove reproducibility and
input/output semantics first.

Android-specific work applies only when AGP and variants are present. Measure
resource processing, variant creation, dexing, and packaging separately; check
current AGP defaults before adding flags such as non-transitive R classes. Do not
assume included builds are faster than project dependencies or split modules
without measuring both configuration overhead and downstream invalidation.

Use a Gradle Profiler scenario for controlled local warm-ups and repeatable edits
when useful. Keep its scenario, JDK, daemon and cache policies aligned with the
real workflow. A local benchmark cannot prove CI queue or runner improvements.

Official sources (consult versions supported by the repository):

- [Gradle performance](https://docs.gradle.org/current/userguide/performance.html)
- [Configuration cache](https://docs.gradle.org/current/userguide/configuration_cache.html)
- [Build cache](https://docs.gradle.org/current/userguide/build_cache.html)
- [Kotlin compilation and reports](https://kotlinlang.org/docs/gradle-compilation-and-caches.html)
- [Gradle Profiler](https://github.com/gradle/gradle-profiler)
- [Android build optimization](https://developer.android.com/build/optimize-your-build)
- [KSP migration](https://developer.android.com/build/migrate-to-ksp)
