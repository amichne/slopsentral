# Evidence for Instruction Changes

Choose the claim before the evaluation.
An instruction can read well and still select the wrong action.

## Define the oracle

Write the expected decision from the user request and authoritative contract before scoring the candidate text.
Include a motivating case, a nearby non-trigger, and a case that preserves useful existing behavior.
Keep expected answers and grading rules outside the prompt supplied to the model.
Use neutral example identities instead of private names or live resource identifiers.

Use the repository's existing case catalog, runner, and report format.
Keep raw responses and transient fixtures outside the distributed skill.
Do not create another evaluation framework for one instruction change.

## Match the evidence

- Source review establishes that the text agrees with the inspected contract.
- Schema or parser tests establish accepted and rejected data at that interface.
- Offline controls establish that the evaluation accepts valid answers and rejects invalid answers.
- A supplied-text decision run establishes model choices for the provided text and cases.
- Automatic routing needs a trace that shows the host selected and loaded the skill.
- Tool behavior needs real calls and an independent assertion about their results.

Before a live run, establish its scope from the task and the host's execution policy.
Keep external writes within the existing authorization.
For a comparison, use the same model, inputs, tools, environment, and grading rules for both variants.
Record model identity and hashes for the supplied prompt, skill, and routed references.
Preserve failures and missing evidence in the report.

## Interpret the result

Report per-case outcomes before an aggregate claim.
If both variants pass equally, report no measured advantage.
Do not infer better task completion from fewer words, a readability score, or an offline fixture.
Keep discovery, decision quality, execution, and comprehension as separate claims.
Stop when the scoped evidence passes and no named risk remains unresolved.
