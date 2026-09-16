# Check The Concept Before Building It

Use this before adding a concept, abstraction, service, state, schema, or policy,
or implementing an inherited plan. Match meaning and behavior, not just names.
For a small fix, a few source references and a focused check are enough.

## Establish Current Evidence

1. State the requested observable outcome in one sentence. Name the consumer
   that needs it and the invariant that must hold now.
2. Establish the checkout revision and relevant local changes. Old plans,
   conversation summaries, generated navigation, and knowledge pages route the
   investigation; reopen the owning source before treating their claims as facts.
3. Locate the nearest existing owner, public entry point, domain representation,
   schema, tests, and direct consumers. Start with repository navigation and
   available semantic or build metadata. Use bounded text search to find likely
   candidates; resolve ambiguous identity with stronger tools when available.
4. Trace one real caller through that owner. Search synonyms and existing
   composition before deciding that a differently named concept is missing.
   A text search with no matches does not prove absence.
5. Run the smallest relevant existing check or demonstrate the precise gap.
   Separate intended behavior, observed behavior, and unproved assumptions.

## Choose The Smallest Sufficient Change

| Decision | Evidence needed | Next action |
|---|---|---|
| Reuse | An existing path satisfies this consumer and invariant | Use or wire it; prove any new wiring separately. No new production abstraction is required. |
| Extend | The owner exists but a concrete case is missing | Add that case at the owner with focused RED/GREEN evidence. |
| Add | No suitable owner was found within a stated search scope and the consumer needs the capability now | Add the smallest type or boundary that owns the missing invariant. |
| Investigate | Identity, behavior, feasibility, or authority remains uncertain | Run one discriminating check or bounded spike. Unknown is not permission to add a competing owner. |

These are decision labels for communication, not a new persisted state protocol.
Keep the evidence in the existing task or PR, or a short progress update:

```text
Need: <consumer and required outcome>
Current: <revision/local delta; owner and check references>
Decision: <reuse / extend / add / investigate; reason>
Delta: <one unmet case, or none>
Proof: <focused check and required verification; stop condition>
```

If acceptance already passes, verify that the check exercises the requested path.
Do not add a regression or rewrite the design to make the task look productive.
If a weak assertion missed a real requirement, improve it and observe its
failure before implementation. If the report cannot be reproduced, report the
evidence and the missing condition rather than claiming the defect was fixed.

## Preserve Flexibility Through Small Commitments

- Prefer an existing type, owner, or composition over a parallel model or cache.
- Introduce a type when it excludes a named invalid state; introduce an
  abstraction when current callers need it. Neither requires a speculative
  framework, provider registry, compatibility shim, or unused configuration.
- Leave future choices open through cohesive modules and explicit effect
  boundaries. Record a future extraction trigger only when it helps, such as a
  second real consumer with different requirements.
- Keep required safety and failure behavior in the first slice. Minimal scope
  never permits ambiguous success, unchecked construction, or swallowed failure.
- After a rebase, merge, or owner/contract change, revisit only the affected
  evidence. Do not rescan an unchanged repository on every red-green cycle.
