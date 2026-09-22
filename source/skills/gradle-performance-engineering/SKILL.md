---
name: "gradle-performance-engineering"
description: "Measure and improve Gradle build performance using Develocity Build Scan APIs. Use for slow builds, performance regressions, configuration or build cache misses, Kotlin compilation, kapt/KSP, dependency resolution, or Gradle latency on GitHub Actions."
---

# Gradle Performance Engineering

Own the measured Gradle optimization loop. Discover the available Develocity
instance, authenticated client, and project permissions before requesting scans.
Use structured scan evidence before console text or UI inspection when access
is available. Missing access is an explicit evidence-unavailable outcome; do
not invent credentials or assume authentication. API access does not guarantee
that every build published every metric. This skill works for JVM, Android, and
multiplatform builds; discover the actual targets instead of assuming
`assembleDebug`.

## Operating Contract

- Use the repository wrapper and discover Gradle, JDK, Kotlin, relevant plugins,
  task selection, runner resources, and cache policies before changing flags.
- Define the workload, primary metric, minimum worthwhile improvement, permitted
  regression, and correctness gates before collecting a candidate result.
- Separate cold, warm, no-change, source-edit, and ABI-edit scenarios. Never
  report a warm candidate against a cold baseline as an optimization.
- Make one causal change per experiment. Preserve task inputs, output semantics,
  test coverage, and required checks. A cache hit is not correctness proof.
- Use version-matched Develocity API contracts. Missing telemetry is an explicit
  evidence failure, not a zero, cache miss, or successful build.
- Leave bounded stage/outcome instrumentation at a diagnosed opaque boundary;
  exclude credentials, source contents, and arbitrary environment dumps.

## Workflow

1. Define the experiment.
   Identify the slow developer or CI scenario and exact wrapper invocation.
   Record baseline/candidate revisions, environment, cache state, repetitions,
   exclusions, and acceptance thresholds. Read
   [measurement.md](references/measurement.md) for metric definitions and sampling.

2. Collect existing scans through the API.
   Read [develocity-api.md](references/develocity-api.md) for discovery, paging,
   build identity, model completeness, and evidence handling. Match scan IDs to
   source revisions and, in CI, run attempts, jobs, matrix cells, and invocations.
   Separate failed/canceled builds from successful timing samples; report both.

3. Locate the dominant cost.
   Separate initialization/configuration, dependency resolution, task execution,
   resource pressure, and CI overhead. Rank work by contribution to the observed
   critical path, not summed parallel task durations. Use Kotlin build reports
   when task-level scan data cannot explain compiler behavior.

4. Change the owning boundary.
   Read [optimization-playbook.md](references/optimization-playbook.md) for
   evidence-triggered interventions. Write the predicted metric change and
   disconfirming signal. For Actions setup, topology, cache transport, or CI/CD,
   use `github-ci-operations` from `software-engineering`; its Gradle reference
   defines the CI handoff. Keep Gradle correctness diagnosis in
   `kotlin-gradle-validation`. If companions are unavailable, state that limit
   and use the official sources linked in this skill.

5. Run matched baseline and candidate experiments.
   Keep runner class, task set, toolchain, resource limits, and cache scenario
   fixed except for the named intervention. Verify required build outputs and
   tests, then compare medians, tails, dispersion, failures, and CI cost.
   Measure both fresh configuration and actual configuration-cache reuse when
   changing configuration behavior.

6. Decide and report.
   Report baseline/candidate scan links, cohort counts, measured values and
   units, absolute and relative deltas, uncertainty, exclusions, correctness
   evidence, and the next decision. Use exactly one conclusion: improvement
   demonstrated, regression demonstrated, inconclusive, or evidence unavailable.
   Revert an unsuccessful experiment within the authorized change scope; keep
   useful diagnosis and describe unresolved limits without claiming a speedup.

## Completion Criteria

- Every performance claim has comparable scan evidence and explicit denominators.
- Required correctness checks pass; missing evidence cannot produce acceptance.
- CI end-to-end latency and runner consumption accompany a CI speedup claim.
- Baseline, experiment, outcome, and remaining uncertainty are reproducible.

Read [provenance.md](references/provenance.md) when revising this skill or
checking upstream ideas and authoritative documentation.
