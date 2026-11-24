---
name: "gradle-performance-engineering"
description: "Measure and improve Gradle build performance using Develocity Build Scan APIs. Use for slow builds, performance regressions, configuration or build cache misses, Kotlin compilation, kapt/KSP, dependency resolution, or Gradle latency on GitHub Actions."
---

# Gradle Performance Engineering

Own the measured Gradle optimization loop. Inspect available reports and their
invocation identities first. When scan evidence is needed, discover the available
Develocity instance, authenticated client, and project permissions before requesting scans.
Use structured scan evidence before console text or UI inspection when access
is available. Missing access is an explicit evidence-unavailable outcome; do
not invent credentials or assume authentication. API access does not guarantee
that every build published every metric. This skill works for JVM and Android
builds; discover the actual targets instead of assuming
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

When unchanged work repeats, compare the producer and consumer keys before changing cache policy or splitting jobs.
For unstable keys, repeated transforms, or suspected false hits, use the [cache diagnosis and controls](references/cacheability.md).
Before normalizing an input, compare what Gradle fingerprints with what the task actually reads.

## Workflow

1. Define the requested diagnosis or experiment.
   Identify the slow developer or CI scenario and exact wrapper invocation.
   For an experiment, record baseline/candidate revisions, environment, cache state,
   repetitions, exclusions, and acceptance thresholds. For a diagnosis, identify
   the available report cohort and the question it can answer. Read
   [measurement.md](references/measurement.md) for metric definitions and sampling.

2. Collect scan or native report evidence.
   Read [develocity-api.md](references/develocity-api.md) for discovery, paging,
   build identity, model completeness, and evidence handling. Match scan IDs to
   source revisions and, in CI, run attempts, jobs, matrix cells, and invocations.
   Separate failed/canceled builds from successful timing samples; report both.
   If a scan or metric is unavailable, record the reason. Use Actions job and
   step timestamps for CI latency. Use Gradle profiles, Kotlin build reports,
   JUnit XML, or native-image reports for work inside the job.
   Bind each report to its invocation and mark metrics the report cannot supply.

3. Locate the dominant cost.
   Separate initialization/configuration, dependency resolution, task execution,
   resource pressure, and CI overhead. Rank work by contribution to the observed
   critical path, not summed parallel task durations. Use Kotlin build reports
   when task-level scan data cannot explain compiler behavior.

4. Select the next action from the observed cost.
   For diagnosis-only work, report the supported cause or remaining uncertainty.
   When the task includes an optimization experiment, read
   [optimization-playbook.md](references/optimization-playbook.md) before changing
   the owning boundary. Write the predicted metric change and
   disconfirming signal. If keys match, trace the entry from a successful writer to a fresh reader.
   For Actions setup, topology, cache transport, or CI/CD,
   use `github-ci-operations` from `software-engineering`; its Gradle reference
   defines the CI handoff. Read `kotlin-gradle-validation` only after explicit user selection.
   Use necessary focused Gradle commands directly otherwise. If companions are unavailable, state that limit
   and use the official sources linked in this skill.

5. When evaluating an intervention, run matched baseline and candidate experiments.
   Keep runner class, task set, toolchain, resource limits, and cache scenario
   fixed except for the named intervention. Verify required build outputs and
   tests, then compare medians, tails, dispersion, failures, and CI cost.
   Measure both fresh configuration and actual configuration-cache reuse when
   changing configuration behavior.

6. Decide and report.
   For a diagnosis, report evidence links, observed costs, and unresolved causes.
   For an experiment, report baseline/candidate evidence links, cohort counts, measured values and
   units, absolute and relative deltas, uncertainty, exclusions, correctness
   evidence, and the next decision. Use exactly one conclusion: improvement
   demonstrated, regression demonstrated, inconclusive, or evidence unavailable.
   Revert an unsuccessful experiment within the authorized change scope; keep
   useful diagnosis and describe unresolved limits without claiming a speedup.

## Completion Criteria

- Every performance claim has comparable scan or native report evidence and
  explicit denominators.
- Required correctness checks pass; missing evidence cannot produce acceptance.
- CI end-to-end latency and runner consumption accompany a CI speedup claim.
- Baseline, experiment, outcome, and remaining uncertainty are reproducible.

Read [provenance.md](references/provenance.md) when revising this skill or
checking upstream ideas and authoritative documentation.
