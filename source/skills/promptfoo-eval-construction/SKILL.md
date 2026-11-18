---
name: "promptfoo-eval-construction"
description: "Author or review Promptfoo cases when a pull request changes a model decision, a skill's scope, or a claim about tool use."
---

# Promptfoo Eval Construction

## Choose the evidence

Start with the claim the reviewer needs to defend.

- **Decision.** Give the model the task and the instructions it can use. Score its choice.
- **Automatic discovery.** Give the host the task with its usual discovery settings. Inspect the trace for the skill it selects.
- **Tool use.** Run the task in a pinned fixture. Use an independent assertion on the requested effect.

Keep deterministic parser and detector behavior in their native tests. If the model must interpret a detector result, give it that result in a decision case.

## Capture review examples

1. List each example the reviewer used to judge where a rule applies, what it catches, or when to skip it.
2. In the same pull request, match each example to an existing Promptfoo case or add the missing case.
3. Pair the case with the nearest plausible exception. Change the fact that determines the answer and keep the surrounding task alike.
4. Give each case a stable ID. Put it in the Promptfoo test description so a reviewer can select it with `--filter-pattern`.
5. Derive the expected outcome from the contract before the run. Keep the answer and its rationale outside the rendered prompt.
6. If the decision needs a reference, supply that reference explicitly. Record the identity of the supplied text.

## Exercise the assertion

Use Promptfoo `vars` for task inputs and `assert` for the expected decision or effect. Reuse the repository's case catalog and grader when they express that contract.

Pass a known correct response through the actual Promptfoo assertion. Pass a plausible wrong response through the same assertion. For a choice set, try an omitted choice and an extra choice. A grader that accepts both decisions needs repair.

Run fresh model cases after the offline controls pass. For an improvement claim, use the same cases and model settings with and without the changed guidance.

Report case IDs, model settings, supplied sources, and outcomes. Label offline results as grader evidence. If credentials or fixtures are missing, report the live cases as unassessed. Keep secrets and raw transcripts outside the skill.
