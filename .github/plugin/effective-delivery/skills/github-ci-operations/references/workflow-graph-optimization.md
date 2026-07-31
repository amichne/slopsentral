# Workflow Graph Optimization

Use this reference when a workflow change alters dependency order, matrix
shape, repeated setup, cache reuse, artifact flow, or expected duration.

## Model Proof Before Runner Proof

Represent the workflow as an expanded directed acyclic graph. One model task is
one actual execution: expand matrix cells and reusable-workflow invocations
instead of treating their YAML declaration as a single node. Give every task:

- only the causal producers in `needs`;
- stable proof-output identifiers;
- observed duration samples from comparable successful runs;
- an execution class such as `static`, `gradle-cache`, `oci`, or
  `artifact-consumer`.

Use medians to schedule the deterministic graph. Report means to expose skew,
but do not let an outlier-heavy mean decide a blocking duration check. Treat a
model with fewer than five comparable samples per changed task as provisional;
keep it report-only until the sample floor is met.

Run the bundled checker:

```sh
python3 "<path-to-skill>/scripts/ci_workflow_model.py" workflow-model.json
```

The input contract is
[workflow-graph-model.schema.json](workflow-graph-model.schema.json). The
checker always rejects missing dependencies, cycles, duplicate proof ownership,
output loss, and unjustified task growth. In `blocking` timing mode it also
rejects excessive critical path, slow fan-out gates, insufficient samples, and
models whose critical path is too far from the observed workflow median.
`provisional` timing mode reports those timing findings without letting early
runner evidence become a false deterministic gate.

## Dependency Ordering

1. Put cheap, deterministic, high-fan-out checks first. A root preflight should
   reject malformed workflow or source contracts without installing unrelated
   toolchains.
2. Fan out producers as soon as their actual prerequisites pass. Parallelism is
   useful only when the nodes do not require one another's state or output.
3. Make consumers depend on the narrowest artifact producer. Do not use a
   cross-platform matrix aggregate when the consumer needs only the Linux
   artifact.
4. Keep independent required proofs independent. A macOS job can remain a
   required check without delaying a Linux OCI consumer.
5. Join late, at the first operation that truly requires every input. Verify
   downloaded artifacts by digest, ledger, or manifest before consumption.

## Task Cardinality

Count executions, not YAML blocks:

```text
executions = triggers x matrix cells x reusable invocations x retries
```

Also count repeated checkout, toolchain, cache restore/save, artifact transfer,
and container startup operations. A new task is justified when it shortens a
shared gate, removes a false dependency, isolates permissions or failure
domains, or creates a reusable artifact. Reject cardinality growth that only
duplicates setup or proof.

Prefer one task when checks share expensive warm state and have the same
platform, permissions, inputs, and failure policy. Prefer separate tasks when
they are independently useful, have different permissions or platforms, or
produce artifacts consumed on different paths.

## Gradle And OCI Boundaries

- Group cache-compatible Gradle tasks behind one JDK, wrapper, Gradle user home,
  and daemon lifetime. Prefer one Gradle invocation for compatible task sets so
  configuration, dependency, and task caches remain reusable.
- Split Gradle work at real platform, permission, publication, artifact, or
  failure-domain boundaries. Publish one immutable artifact plus provenance;
  consumers should not rebuild it.
- Build an OCI image or bundle once, identify it by digest, then fan out
  environment or base-image validation from that producer. Rebuilding identical
  content in every matrix cell destroys both layer reuse and equivalence proof.
- Expand only meaningful OCI axes. Do not multiply a matrix by values that do
  not change the image, runtime contract, or supported environment.
- Keep container consumers off unrelated platform joins. Their dependencies are
  the image/bundle, its provenance, and any runtime they actually install.

## Equivalence And Forward Progress

Inventory stable proof outputs before moving tasks. The candidate graph must
retain the baseline set unless an intentionally retired output is handled in a
separate contract change. Use artifact digests, ledgers, test report identities,
and package manifests where byte-for-byte outputs are practical; use stable
proof identifiers for behavioral checks.

Forward progress requires all of the following:

- the candidate output set is equivalent;
- every dependency is causal and the graph remains acyclic;
- the median-modeled critical path and fan-out gate meet explicit budgets;
- task-count growth stays inside an explicit budget;
- the modeled critical path remains close enough to observed workflow medians
  to be representative.

Do not make live runner duration a deterministic test. Runner queues, cache
temperature, hosted image changes, and network variance belong in observation
profiles. Refresh the model from comparable successful runs, review the changed
sample set, and commit the stable summary only when the repository wants the
performance budget shared.

## Kast Evidence Behind These Rules

Kast PR 359 moved Rust-backed runtime contracts out of the shared static gate,
split Linux and macOS reusable workflow invocations so Linux consumers no
longer joined on macOS, removed a no-op snapshot pull-request trigger, and
limited Java/Gradle snapshot setup to manual publication. The static gate moved
from a median of 111 seconds across eight prior successful runs to 7.5 seconds
across the first two successful candidate runs. Overall successful-run duration
was 1,200.5 seconds at the prior eight-run median and 904 seconds for the first
two candidate runs.

The bundled
[kast-workflow-optimization-model.json](kast-workflow-optimization-model.json)
preserves the observed samples and output inventory. Its candidate timing is
explicitly provisional until at least five comparable successful runs exist;
the executable tests use a five-sample stub to prove blocking behavior without
hosted-runner variability.
