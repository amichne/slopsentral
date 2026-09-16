# Gradle Performance on GitHub Actions

Use `gradle-performance-engineering` for the Gradle measurement loop and
Develocity model interpretation. This reference owns the Actions environment,
workflow graph, cache transport, and evidence handoff. Assume full Develocity API
access, but account for absent publishing credentials in untrusted PR contexts.

## Establish the CI Baseline

Read triggers, required checks, merge-queue behavior, expanded matrix, `needs`,
runner class/image/resources, wrapper/JDK setup, and existing cache actions.
Collect structured run/job/step timestamps and conclusions, including attempts
and canceled runs. Correlate scans using source SHA, run ID, attempt, job,
matrix dimensions, and invocation identity. Preserve the tested merge SHA as
well as the PR head SHA when they differ.

Measure event-to-required-check completion, queue delay where observable, job
startup/setup, Gradle invocation, artifact upload, and post-job cache save.
Report p50 and a sufficiently sampled p95, sample sizes and dispersion; also sum
job execution durations across the matrix and retries as runner consumption.
A faster Gradle invocation can still produce slower CI. A modeled critical-path
reduction predicts an improvement; matched observed runs must confirm it.

## Cache Ownership and Trust

- Prefer the repository's version-compatible `gradle/actions/setup-gradle`
  integration for Gradle User Home transport. Avoid simultaneously managing the
  same directories through `actions/cache` or `setup-java` Gradle caching.
- Distinguish dependency artifacts, configuration-cache state, local task outputs,
  remote task-output cache, and uploaded delivery artifacts. Record restore/save
  times, bytes and hit outcomes per layer; a transport cache hit does not imply a
  Gradle task-output hit. Job filesystems are independent unless state is
  explicitly transferred; a setup job does not populate downstream workspaces.
- Verify the pinned action's documented defaults and read/write restrictions.
  Permit cache writes only from trusted producers. `CI=true` is not a trust
  boundary. Fork PRs and arbitrary branch builds must not gain privileged remote
  cache writes or Develocity credentials merely to improve measurements.
- Configuration-cache transport can contain sensitive material. Use the action's
  supported encryption-key mechanism where needed; preserve secret boundaries
  and measure restore behavior in each event context. Do not expose credentials
  to untrusted code or silently mark missing scan evidence complete.
- Use the organization's configured Develocity instance and publishing policy.
  Do not change scan terms, publish to a public service, or dump environment
  variables as part of optimization. Report scan links and bounded metrics in
  job summaries; retain only needed diagnostic artifacts with defined retention.

## Work Selection and Quality Gates

Use affected-task selection only with a proven dependency/consumer closure and
an available comparison base. Include new/deleted modules, shared build logic,
settings, version catalogs, plugins, generated inputs, and cross-module contracts.
Fetch enough history for the chosen comparison; full history is not inherently
required if the necessary base is present. If impact cannot be proven, broaden
to the repository's required validation set and state why. Run periodic/full
validation where policy requires it; never ban full PR suites categorically.

Preserve compile, tests, analysis, packaging, and coverage obligations appropriate
to the project. Keep stable required check names and an explicit aggregate result
for affected jobs. Verify failure, skipped work, cancellation, new-module, and
merge-queue paths cannot manufacture a green result. Do not use `-x test` or
`-x lint` to claim a performance improvement over a baseline that ran them.

Budget matrix cardinality and runner resources before adding parallelism. Split
jobs only when saved critical-path time outweighs repeated setup, compilation,
cache transfers, and artifacts. Choose test sharding using measured durations
while preserving test inventory. Use bounded timeouts and cancel superseded
validation intentionally; deployment cancellation needs its own recovery policy.

## CI/CD Beyond the Build

Use reviewed immutable action commits and explicit runtime versions; resolve
real revisions, never invent hashes. Reusable workflows share multi-job contracts;
composite actions share steps. Avoid making a costly setup or build job a shared
prerequisite when downstream checks do not consume its outputs.

For deployments, prefer provider-supported OIDC with constrained repository,
ref/environment, and audience claims, scoped job permissions, and protected
environments. Treat Develocity authentication as its own supported API boundary;
cloud OIDC support does not imply Develocity supports that exchange. Build a
versioned artifact once, tie its digest to validation/provenance, and promote that
identity across environments. Define rollback to a known validated artifact.
Use `delivery-pipeline-design` and `release-flow.md` for promotion and release
work; optimization does not itself authorize deployment or protection changes.

## Acceptance and Handoff

Run workflow lint and validate changed scripts/Gradle tasks. Exercise affected
selection and cache policy in representative trusted/untrusted event contexts
when those contracts change. Compare equivalent baseline/candidate CI cohorts
and disclose absent event coverage. Preserve correctness and required-check
behavior, then assess agreed latency, tail, failure and consumption budgets.
Report the Actions run and scan links together; do not declare success from a
cache ratio, one fast runner, or a graph model alone.

Sources: [Gradle Actions setup and cache behavior](https://github.com/gradle/actions/blob/main/docs/setup-gradle.md),
[GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[GitHub Actions security](https://docs.github.com/en/actions/security-for-github-actions).
Recheck the pinned action and repository policy before changing YAML.
