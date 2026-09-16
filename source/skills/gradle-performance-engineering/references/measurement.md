# Measurement Contract

Choose a primary outcome with the build owner: developer feedback latency,
required-check completion latency, or CI compute consumption. Set project-specific
absolute and relative budgets before looking at candidate results. Cache hit rate
and CPU utilization are diagnostic measures, not universal success targets.

## Comparable Cohorts

Record source SHA, workload/task arguments, Gradle/JDK/Kotlin/plugin versions,
OS/architecture, runner image/class, CPU and memory limits, worker/test-fork limits,
daemon state, dependency availability, local/remote output-cache state, and
configuration-cache state. Record the exact change applied between revisions.
Compare within each stratum; do not pool different task sets or runner classes.

| Scenario | Controlled preparation | Question |
| --- | --- | --- |
| Cold | Disposable workspace and Gradle user home; define dependency and remote cache availability explicitly | What is first-use cost? |
| Warm no-change | Identical invocation after a successful seed build; retain outputs | Does unchanged work stay up-to-date and configuration get reused? |
| Implementation edit | Apply the same non-ABI source patch to seeded baseline/candidate trees | Is compilation incremental and limited to expected consumers? |
| ABI edit | Apply the same public-signature patch with equivalent valid consumers | Is downstream invalidation correct and bounded? |
| CI cache reuse | Fresh workspace with explicitly populated dependency/output caches | Does cache transport reduce end-to-end job time? |

`clean` removes project outputs; it does not reset dependency, remote build, or
configuration caches. `--rerun-tasks` changes reuse behavior. Neither silently
stands in for a cold or representative incremental workload. Do not delete shared
caches to simulate cold builds; isolate the experiment.

Use a declared warm-up policy and several measured repetitions per variant and
scenario. Five per variant is a pilot, not a tail-latency proof. Alternate or
randomize baseline/candidate order to reduce time-dependent runner noise. Report
sample count, median and dispersion (IQR or MAD). Name the percentile estimator;
report p95 only with a sample count sufficient for the intended tail claim, and
label a small-sample tail estimate unstable. Increase samples when the effect is
within noise; an overlapping uncertainty range is inconclusive. For controlled
paired runs, retain pair identity and analyze paired deltas. For historical
cohorts, describe confounders and avoid causal claims without reproduction.

## Metric Definitions

| Metric | Definition and interpretation |
| --- | --- |
| Gradle elapsed | Successful invocation end minus start, in ms; separate reported configuration and execution spans without assuming all spans are additive |
| Critical path | Dependency-constrained task timeline from supported scan data; summed task time is work, not wall time; label approximations |
| Configuration-cache reuse | Reused / attempts with a known reuse outcome; separately count stored, invalidated, disabled, failed, and unknown |
| Build-cache effectiveness | `FROM-CACHE` / (`FROM-CACHE` + executed cacheable tasks with known cache eligibility), task-instance denominator; report local/remote distinction only if exposed |
| Task avoidance | Counts of `UP-TO-DATE`, `FROM-CACHE`, executed, skipped, `NO-SOURCE`, failed, and unknown; do not count up-to-date work as remote cache hits |
| Incremental compilation | Incremental / compiler invocations with a known mode; include nonincremental reasons and downstream task count, not just compile duration |
| Dependency cost | Observed resolution/download durations and transferred bytes when available; distinguish network wait from configuration work |
| Resource pressure | Available CPU, peak memory, GC duration, worker concurrency, and idle/wait evidence with scope (process or runner); unavailable is explicit |
| CI latency | Event-to-required-check completion plus separately observed queue/startup/setup/build/upload/cache-save spans; do not attribute all overhead to Gradle |
| CI consumption | Sum of job running durations across matrix cells and attempts; distinguish runner-minutes from billed cost and apply documented runner rates only when known |
| Reliability | Failed attempts / all eligible attempts; report cancellation, infrastructure failure, test failure, and retry recovery separately |

Never manufacture eligible-task counts from missing cacheability fields. If the
server reports a different cache ratio, retain its name/denominator instead of
presenting it as this ratio. Zero denominators produce an unavailable ratio.
Configuration reuse and task-output caching are independent layers.

For lower-is-better metrics, report `candidate - baseline` in native units and
`100 * (candidate - baseline) / baseline` as percent change. A zero baseline has
no relative delta. Do not sum overlapping phase durations or scan builds executed
concurrently in one job. A faster build that increases tail latency, failures, or
runner consumption beyond agreed limits fails acceptance.

## Evidence Handoff

A concise Markdown report is sufficient: hypothesis, exact invocations, scenario
preparation, cohort identities/counts, metrics table, uncertainty, correctness
results, and decision. If automation persists JSON, define and validate a local
schema first: units, identities, finite outcome enums, nonnegative durations,
positive counts where required, and explicit unavailable reasons. Keep raw API
models separate from derived aggregates so transformations remain auditable.
