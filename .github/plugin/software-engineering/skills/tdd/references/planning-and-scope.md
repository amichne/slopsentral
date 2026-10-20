# Planning and scope

Use this procedure when the user requests a validation plan or a measurable goal.
A request for a plan authorizes the plan only. Do not edit source or run tests without execution authority.

1. Name the consumer, observable outcome, protected invariant, scope, non-goals, and stop condition.
2. Separate supplied claims, examined evidence, inferences, and unknown facts.
3. Inspect the current owner, contracts, callers, and tests before a design decision.
4. Choose reuse, extend, add, or investigate from that evidence.
5. Specify the smallest faithful oracle, input, setup, expected result, failure, and negative control.
6. Name the mechanism this oracle exercises and the claims it cannot prove.
7. Name the next system layer and its entry condition when that gap affects acceptance.

Ask only questions whose answers change acceptance, scope, safety, or authority.
Keep proposed results separate from passed, failed, skipped, and not-run results.
Do not replace the original objective with the easiest passing subset.

Use a goal tool only after an explicit request for goal-backed work.
Inspect the existing goal before creation. Keep its scope through later clarifications.
Completion needs evidence for the entire objective. An unavailable goal tool does not prevent ordinary authorized work.

This procedure combines the former validation-first and define-goal workflows.
The original planning source and digest remain in [planning provenance](planning-provenance.md).
