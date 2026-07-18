---
name: "tdd"
description: "Use when a behavior, invariant, bug fix, contract, or refactor should be developed red-green-refactor and any shell-invokable check can provide focused executable proof."
---

# Executable-Check TDD

Use this skill to drive one observable change at a time with an executable
check. The check does not need to come from a test framework: a compiler, type
checker, linter, schema validator, build task, repository script, or focused
shell command can be the oracle when its exit status proves the target claim.

Use these repo-level concepts when they are available and relevant:

- `concepts/type-safety/core.md`
- `concepts/schema-driven-design/core.md`

## Operating Contract

- Read the nearest repository instructions, existing checks, and build metadata
  before choosing a command.
- State one acceptance behavior and one check specification before changing the
  implementation.
- A check specification is its working directory, exact command, controlled
  inputs and environment, expected RED failure, and GREEN success criterion.
- Run the same check specification for RED and GREEN. Only the intentional
  implementation change should explain the transition.
- Commit and push each validated RED and passing GREEN checkpoint before continuing; if no publishable Git remote exists, record that limitation.
- RED is valid only when the check ran and failed because the target behavior or
  invariant is absent.
- Infrastructure failures are not RED: command-not-found, dependency setup,
  syntax errors in the check, timeouts, permission failures, and unrelated
  failures must be repaired or isolated first.
- If the new check passes before the implementation change, strengthen the check
  until it proves the missing behavior. An already-green check is not regression
  evidence.
- Do not refactor while red or add production behavior not demanded by the
  current check.

Read [executable-check-contract.md](references/executable-check-contract.md)
when selecting or adapting a non-test command, qualifying a RED result, or
stabilizing the check specification.

## Workflow

1. Frame one observable behavior, invariant, or failure and its owning boundary.
2. Discover the narrowest shell-invokable check that can distinguish the current
   state from the desired state.
3. Declare the check specification. Preflight the runner or dependencies
   separately when their readiness is uncertain.
4. Add or tighten the smallest check before changing the implementation.
5. Run the declared command and inspect the failure. Accept RED only when it
   fails for the expected reason.
6. Implement the narrowest vertical slice that can satisfy that check.
7. Run the same check specification and accept GREEN only when it exits zero and
   its output supports the intended claim.
8. Refactor while green, rerunning the focused check after each meaningful move.
9. Repeat for the next behavior. Widen to broader verification only after the
   focused loop is green.

Ask for clarification only when the acceptance boundary, critical behavior, or
risk tolerance cannot be inferred from the task and local evidence.

## Evidence And Handoff

Prefer a repository-native workflow record when one exists. Otherwise preserve:

- goal and acceptance behavior;
- check specification: working directory, exact command, controlled inputs, and
  success criterion;
- phase: `RED`, `GREEN`, `REFACTOR`, `VERIFY`, or `DONE`;
- RED evidence: exit code and the expected failure signal;
- GREEN evidence: exit code and the success signal from the same check;
- RED and GREEN checkpoint commit SHAs and push state;
- changed scope, broader verification, next behavior, and blockers.

Load [handoff.md](references/handoff.md) for long-running work, interruptions,
multi-agent handoffs, or work with several red-green cycles.

## Completion Criteria

- The focused check was observed failing for the intended reason before the
  implementation change.
- The same check specification passes after the narrow implementation.
- Every validated RED and passing GREEN checkpoint was committed and pushed, or
  the missing publishable Git remote is reported.
- Refactoring, if any, happened while the focused check remained green.
- Relevant broader checks pass, or their exact residual failures are reported.
- The handoff names exact commands and results rather than claiming confidence.

## Reference Routing

- Read [tests.md](references/tests.md) when the executable check is a behavior test.
- Read [mocking.md](references/mocking.md) when an external boundary may need a test double.
- Read [interface-design.md](references/interface-design.md) when a public code seam is hard to exercise.
- Read [deep-modules.md](references/deep-modules.md) when test friction suggests a shallow interface.
- Read [refactoring.md](references/refactoring.md) only after GREEN when choosing cleanup moves.
- Read [handoff.md](references/handoff.md) when evidence must survive interruption or transfer.
