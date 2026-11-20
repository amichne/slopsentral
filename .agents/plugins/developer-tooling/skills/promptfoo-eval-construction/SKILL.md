---
name: "promptfoo-eval-construction"
description: "Author or review Promptfoo cases for changes to model decisions, skill scope, or tool-use claims. Choose decision, discovery, or execution evidence from the claim; deterministic parser behavior remains in its native tests."
---

# Promptfoo Eval Construction

## Choose the evidence

Start with the claim the reviewer needs to defend.
Inspect the existing case catalog, runner, grader, and retained evidence first.
Reuse the case and assertion when they already express the contract. Extend
those owners for a missing decision instead of starting another evaluation runner.

- **Decision.** Give the model the task and the instructions it can use. Score its choice.
- **Automatic discovery.** Give the host the task with its usual discovery settings. Inspect the trace for the skill it selects.
- **Tool use.** Run the task in a pinned fixture. Use an independent assertion on the requested effect.

Keep deterministic parser and detector behavior in their native tests. If the model must interpret a detector result, give it that result in a decision case.

## Capture review examples

1. List each example the reviewer used to judge where a rule applies, what it catches, or when to skip it.
2. Match each example to an existing Promptfoo case. When authoring is in scope,
   add a missing case with the instruction change, in the same pull request
   when delivery uses one. For a review-only task, identify the coverage gap
   without claiming a case or model run exists.
3. Pair the case with the nearest plausible exception. Change the fact that determines the answer and keep the surrounding task alike.
4. Give each case a stable ID. Put it in the Promptfoo test description so a reviewer can select it with `--filter-pattern`.
5. Derive the expected outcome from the contract before the run. Keep the answer and its rationale outside the rendered prompt.
6. If the decision needs a reference, supply that reference explicitly. Record the identity of the supplied text.

## Exercise the assertion

Use Promptfoo `vars` for task inputs and `assert` for the expected decision or effect. Reuse the repository's case catalog and grader when they express that contract.

Pass a known correct response through the actual Promptfoo assertion. Pass a plausible wrong response through the same assertion. For a choice set, try an omitted choice and an extra choice. A grader that accepts both decisions needs repair.

When fresh evaluation is in scope, run model cases after the offline controls
pass. A case-authoring request does not by itself require a paid model run.
Use authority already supplied instead of requesting it again. For an
improvement claim, use the same cases and model settings with and without the changed guidance.
If a required live gate cannot run within the task's authority or available
setup, report it as not run; offline controls do not satisfy that gate.

Report case IDs, model settings, supplied sources, and outcomes. Label offline results as grader evidence. If credentials or fixtures are missing, report the live cases as unassessed. Keep secrets and raw transcripts outside the skill.
