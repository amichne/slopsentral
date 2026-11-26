# Task Briefs

Give the receiver enough context to decide and act within the assigned scope.
Preserve the user's requested result without converting every prior suggestion into a requirement.

## Brief content

- State the consumer and the result the receiver must return.
- State whether the task permits research, review, edits, publication, or another named effect.
- Name the owned paths and shared files that other work can change.
- Identify authoritative sources with paths or URLs and revisions when the claim depends on a version.
- Label known outcomes, suspected causes, and rejected approaches separately.
- Define the decisive check, its expected outcome, and the nearest counterexample.
- Name the returned evidence and the condition that ends the task.

For an inherited conversation, supply only the missing task scope and evidence.
For a fresh receiver, include facts that the receiver cannot retrieve from its own tools.
Use a direct command for a fixed lookup.
Use a question and an evidence target for an investigation whose cause remains unknown.

## Example investigation brief

The project import failed in CI run `<run-id>` at revision `<sha>`.
The log names `WorkspaceAdmission` as the failed stage.
A local run at another revision passed, so it does not explain the CI result.
The suspected cause is stale workspace state, but the supplied evidence does not establish that cause.

Inspect the admission path without edits.
Find the first failed condition and a contrasting control with the same input contract.
Return source locations, the evidence for each conclusion, and the smallest experiment that distinguishes unresolved causes.
Do not publish or repair the implementation during this review.

## Repeated and asynchronous work

For an event, name its source, resource identity, state, and event version or time.
Keep the event's facts separate from the action authorized by the parent task.
Report a child's outcome as evidence for its own scope.
Do not turn that outcome into an instruction that ends the parent's broader task.

For a scheduled prompt, name the durable state owner and the rule for unchanged input.
Before another external effect, examine whether the previous invocation already completed it.
If an effect has an unknown outcome, request its status through the supported recovery path.
Do not infer that a timeout means the effect never occurred.
