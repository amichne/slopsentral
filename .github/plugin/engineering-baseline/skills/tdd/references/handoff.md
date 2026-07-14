# TDD Handoff

Use this reference when work may continue across sessions, agents, or long
implementation loops. The goal is to make the next agent trust the state from
evidence, not from narrative confidence.

## Phase Vocabulary

- `RED`: A behavior test exists and fails for the expected reason.
- `GREEN`: The targeted behavior test passes with minimal implementation.
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
Phase:
Changed files:
Check specification:
- Working directory: <path>
- Command: <exact command>
- Controlled inputs and environment: <fixtures, variables, or none>
- Expected RED failure: <signal>
- GREEN success criterion: <signal>
Evidence:
- RED: <command> -> <result>; artifact: <path or none>
- GREEN: <command> -> <result>; artifact: <path or none>
- REFACTOR: <command> -> <result>; artifact: <path or none>
- VERIFY: <command> -> <result>; artifact: <path or none>
Next:
Blockers:
```

## Rules

- Prefer an existing workflow CLI, hook, issue template, or handoff file if the
  repository has one.
- Do not create a new persistent state directory unless the user or repo
  convention asks for one.
- Record exact commands and results; avoid vague proof such as "tests look good."
- Record one stable check specification for each RED-to-GREEN cycle. A changed
  command, working directory, controlled input, or meaningful environment value
  starts a different cycle.
- If paused while red, include the expected failure and why it is the intended
  failure.
- Do not record setup, authentication, dependency, timeout, permission, or
  unrelated failures as RED.
- If blocked, include the missing input or external state needed to continue.
