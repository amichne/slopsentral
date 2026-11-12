# TDD Handoff

Use this reference when work may continue across sessions, agents, or long
implementation loops. The goal is to make the next agent trust the state from
evidence, not from narrative confidence.

## Phase Vocabulary

- `BASELINE`: Current behavior or runner readiness is being established; a pass
  here is not a historical RED.
- `RED`: A focused executable check fails for the intended missing invariant.
- `GREEN`: The same check specification passes with minimal implementation.
- `REFACTOR`: Cleanup is happening while the targeted proof stays green.
- `VERIFY`: Broader checks are running because the change crosses a boundary.
- `DONE`: Acceptance criteria and relevant verification have passed.

## Handoff Shape

Use this shape in a final response, status update, or repository-native
handoff artifact when one already exists:

```text
Goal:
Acceptance:
Scope:
Current owner and evidence:
Decision and unmet delta:
Mode: <reuse / characterization / behavior change / investigation>
Phase:
Changed files:
Check specification:
- Working directory: <path>
- Command: <exact command>
- Controlled inputs and environment: <fixtures, variables, or none>
- Assertion source and fixture revision: <references>
- Expected RED failure: <signal>
- GREEN success criterion: <signal>
Evidence:
- BASELINE: <command> -> <result and interpretation>
- RED: <command> -> <result>; artifact: <path or none>
- GREEN: <command> -> <result>; artifact: <path or none>
- REFACTOR: <command> -> <result>; artifact: <path or none>
- VERIFY: <command> -> <result>; artifact: <path or none>
Limits: <skips, cache provenance, unproved runtime boundary, or none>
Stop condition:
Next:
Blockers:
```

## Rules

- Prefer an existing workflow CLI, hook, issue template, or handoff file if the
  repository has one.
- Do not create a new persistent state directory unless the user or repo
  convention asks for one.
- Use only fields that help resume the task; an ordinary change needs a short
  transition update, not a form copied at every step.
- Record exact commands, exit status, and intended signals; avoid vague proof
  such as "tests look good." Report assertion counts, skips, and elapsed time
  when those affect the interpretation or cost of the check.
- Record one stable check specification for each RED-to-GREEN cycle. A changed
  command, assertion source, working directory, controlled input, or meaningful
  environment value starts a different cycle.
- For reuse, report the already-satisfied requirement and verified existing path.
  For a refactor, report the passing characterization before and after. Neither
  needs fabricated RED evidence.
- If paused while red, include the expected failure and why it is the intended
  failure.
- Do not record setup, authentication, dependency, timeout, permission, or
  unrelated failures as RED.
- If blocked, include the missing input or external state needed to continue.
