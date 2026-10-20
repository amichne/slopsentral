# Focused Testing And Codebase Preflight

Audit date: 2026-09-12. Source baseline: `2a2c334`.

The highest-value change is to make implementation conditional on a demonstrated
gap. Keep the strong executable-check discipline, but let verified reuse finish
a task, let characterization support a refactor, and require a reason to widen
testing. Spend model reasoning on the owner, invariant, counterexample, and
uncertain boundary before spending it on more implementation.

## Evidence And Limits

This audit inspected the current TDD skill and references, adjacent Kotlin and
knowledge guidance, engineering instructions, benchmark definitions, ownership
tests, and relevant Git history. It also sampled four recent engineering
conversations: continuation/recovery triage, pipeline optimization, staged
host-plugin delivery, and repository-profile activation. The sample is selective,
not a complete history or a controlled comparison of models.

The conversation findings below are based on retained user requests, command
results, and handoffs. Their product tests were not rerun for this audit. Private
transcripts, enterprise identifiers, and local incident payloads are not included.

| Observed pattern | Useful lesson | Change to make habitual |
|---|---|---|
| Continuation and settled-read failures were reproduced independently with deterministic fixtures; the handoff separated those defects from an unproved historical payload | Narrow tests can establish a defect without recreating an enterprise environment | Treat incident explanations as hypotheses; test producer/consumer agreement and recovery independently |
| The pipeline investigation measured 141 Detekt analyses, discovered that the aggregate already owned the work, and reduced the graph to 47 | Inspect ownership and the actual graph before adding optimization machinery | Check for existing capability and redundant execution before adding a cache, classifier, or abstraction |
| Installer fixtures exercised archive and filesystem contracts without launching IntelliJ; later release work encountered a missing Python dependency | Fast contract proof and real host proof have different boundaries; runner setup needs its own evidence | Keep setup failures out of RED and state exactly which platform claim remains unproved |
| Profile activation reused an existing profile, then local installation exposed an overly broad inventory query | Reuse can be the right design while a real boundary still needs a tracer bullet | Verify one actual consumer path before claiming the whole integration works |

These patterns support the workflow changes. They do not establish a measured
speedup from this skill revision.

## Findings In The Current Guidance

1. **An already-green check could create unnecessary work.** The old TDD rule
   instructed the agent to strengthen a passing initial check until it proved a
   missing behavior. That is appropriate for weak coverage only after the unmet
   requirement is established. It can otherwise encourage scope expansion or a
   duplicate implementation. The revised skill recognizes reuse and passing
   characterization explicitly.

2. **The benchmark assumed a missing feature that exists.** Its prompt requested
   duplicate-manifest rejection. The current [catalog validator](../tools/catalog.mjs)
   already rejects duplicate marketplace identities, and the
   [ownership regression](../tools/tests/catalog-ownership.test.mjs) exercises it
   through a mutated temporary fixture. This audit ran:

   ```sh
   node --test --test-name-pattern='rejects duplicate identities' tools/tests/catalog-ownership.test.mjs
   ```

   It passed one selected test before edits. This is reuse evidence, not RED.
   The benchmark now rewards discovering the existing owner and avoiding a
   competing validator.

3. **The check identity was incomplete.** Exact commands, inputs, and environment
   were already required, but an agent could still add or change assertions and
   attribute their new coverage to an earlier RED. The check contract now includes
   assertion source and fixture revision. Added controls receive their own
   evidence, and empty selections, skips, and uncertain cache provenance cannot
   silently stand in for a passing assertion.

4. **Test advice overgeneralized useful heuristics.** The old reference favored
   integration-style public APIs, one logical assertion, and blanket avoidance of
   call counts/order. For this workload, identities, exact dispatch counts, and
   serialization can be the public contract. The revision chooses the smallest
   owning boundary and the assertions that distinguish a plausible wrong fix.

5. **Tracer bullets were described mostly as another red-green loop.** The new
   reference distinguishes a retained production path from a disposable feasibility
   spike. A unit test proves its rule; a real boundary check proves the connection.
   Neither automatically proves a running IDE or deployed artifact.

6. **Checkpoint publication is a deliberate but costly policy.** Commit `89ba1fd`
   introduced mandatory RED/GREEN commit-and-push checkpoints, and the
   [personal-delivery policy test](../tools/tests/personal-delivery-policy.test.mjs)
   protects it. It remains in this revision. A useful next experiment would keep
   reproducible local evidence and publish green vertical slices, with red pushes
   reserved for an explicit handoff need. That would be a separate policy change,
   not an excuse to omit requested delivery or required CI.

The [official Astra guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra)
describes sensitivity to skill instructions and a tendency toward thorough
testing that can be excessive for small changes. These findings suggest making
scope, evidence, and stopping rules explicit. This is a workflow inference,
not a claim that an instruction change has already improved Astra performance.

## The Working Agreement

Before implementation, use the
[codebase preflight](../source/skills/tdd/references/codebase-preflight.md):

```text
Need: A consumer must resume a continuation emitted by the producer.
Current: The codec and operation metadata already have canonical owners;
         the current schema regression shows the precise mismatch.
Decision: Extend the existing contract owner.
Delta: Admit the valid production representation without weakening rejection.
Proof: Producer → output schema → input schema → consumer, plus wrong-authority
       rejection. Run affected consumer and required repository checks, then stop.
```

This is a short decision record in the conversation or existing PR. It does not
require a new workflow directory, knowledge database, JSON ledger, or approval
ceremony. If the implementation and check already satisfy the requirement, the
delta is none. If evidence is ambiguous, investigate instead of building another
owner. A large inherited plan is reduced to the next required, independently
testable outcome.

For development, select one of four modes:

| Mode | Evidence sequence | Appropriate finish |
|---|---|---|
| Reuse | Current source → existing consumer path → passing check | Existing capability verified; add only necessary wiring |
| Characterization | Passing behavior check → structural change → same passing check | Behavior preserved; no claimed historical RED |
| Behavior change | Intended failing assertion → smallest implementation → same passing assertion | One unmet invariant satisfied, then affected verification |
| Investigation | Bounded question → discriminating observation | Finding and limits; production work only when the next decision is supported |

Interpret “lazy development” as avoiding unnecessary decisions and repeated work.
Use an existing owner, keep a pure rule independently testable, encode the named
invariant with the smallest useful type, and defer variation until a real consumer
needs it. A flexible design needs clear boundaries; it does not need every future
provider, mode, flag, fallback, or compatibility layer in advance.

## Concrete Ways To Use This With Astra

- Ask for the current owner, consumer, and unmet case before the implementation.
  This makes codebase understanding reviewable while it can still prevent work.
- Ask what plausible wrong implementation would pass the proposed test. Add the
  nearest counterexample instead of an undirected suite of edge cases.
- Request a short transition update: selected check, intended failure, passing
  result, and remaining boundary. Native reports retain detail; repeated full
  command logs obscure the decision.
- Separate the fast deterministic check from the one real integration check
  that resolves the outstanding uncertainty. For platform work, state whether
  the evidence covers policy, adapter behavior, archive installation, or a live
  host. Escalate only when the required claim crosses that boundary.
- Set the finish before coding: focused assertion, direct consumers, mandatory
  checks, and any required runtime proof. Further runs need changed inputs, a
  failure, or a named unresolved risk.
- Record optional work with a trigger: extract when a second consumer needs the
  rule; add a provider seam when a second provider is required; add a cache after
  measuring repeated expensive work. Do not implement the trigger speculatively.

A reusable task prompt:

> Check this proposal against the current codebase. Identify the existing owner,
> consumer, and tests; choose reuse, extend, add, or investigate. Implement only
> the unmet requirement. For changed behavior, keep the same assertion, command,
> fixtures, and meaningful environment through RED/GREEN. For existing behavior
> or refactoring, report the passing baseline honestly. Choose the cheapest
> sufficient proof, exercise the uncertain real boundary once when needed, run
> required checks, and stop. Preserve types and closed failures. Report what the
> evidence proves and what remains unknown.

## Evaluation And Rollout

The revision extends the existing `tdd` skill and engineering-design instruction;
it adds no new skill, hook, execution framework, or persistent proof protocol.
Engineering Baseline is versioned to `1.1.2`, with its marketplace reference kept
in sync. Optional preflight and tracer detail lives in bundled references.

The [benchmark definition](../source/evals/plugin-benchmarks/engineering-baseline.json)
now includes existing-capability, zero-selected-tests, and missing-check cases.
They are candidate task rubrics. Source-graph validation and routing replay can
validate their structure and ownership, not measure model behavior. No live
old-versus-candidate Astra benchmark was run in this audit.

Local verification passed the source graph, generated catalog, 42 routing
fixtures, nine focused ownership/benchmark/delivery-policy tests, direct Draft
2020-12 validation of the benchmark, and both provider projections using the
CI-pinned projeKtor `v1.2.0`. Local Markdown links and the exact projected TDD
contents were checked. The generic schema-authoring policy wrapper rejects
pre-existing conventions in the benchmark schema; direct validation against
that unchanged schema passes. No product regression RED is claimed for these
guidance edits.

For a subsequent controlled comparison, pin the same source revision, model,
reasoning settings, and environment for both guidance versions. Include those
three cases and independently prepared cases for one truly missing invariant,
one characterization refactor, and one real adapter boundary. Keep the scorer
outside the agent's editable workspace. Score invariant correctness and evidence
honesty first; then compare unnecessary production edits, time to the first
useful result, repeated checks on unchanged inputs, and total check time. Report
per-case results and regressions rather than inferring improvement from fewer
tests, fewer tokens, or a passing static fixture.
