---
name: "tdd"
description: "Use for behavior changes, bug fixes, contract changes, or tracer bullets that need a current-codebase preflight and focused executable proof; also for characterization before a refactor."
---

# Executable-Check TDD

Use this skill to drive one observable change at a time with an executable
check. The check does not need to come from a test framework: a compiler, type
checker, linter, schema validator, build task, repository script, or focused
shell command can be the oracle when its exit status proves the target claim.

Honor the `type-safety` and `schema-driven-design` semantic context when the
host supplies it and it is relevant to the behavior under test. Otherwise use
the nearest repository-local equivalent.

## Operating Contract

- Read the nearest repository instructions, existing checks, and build metadata
  before choosing a command.
- Check the proposed concept against current owners, callers, contracts, and
  tests before adding it. Choose reuse, extend, add, or investigate from that
  evidence; a plan or incident report is a hypothesis until checked.
- State one acceptance behavior and one check specification before changing the
  implementation.
- A check specification is its working directory, exact command, controlled
  inputs and environment, assertion source, expected RED failure, and GREEN
  success criterion.
- Run the same check specification for RED and GREEN. Only the intentional
  implementation change should explain the transition.
- Commit and push each validated RED and passing GREEN checkpoint before continuing; if no publishable Git remote exists, record that limitation.
- RED is valid only when the check ran and failed because the target behavior or
  invariant is absent.
- Infrastructure failures are not RED: command-not-found, dependency setup,
  syntax errors in the check, timeouts, permission failures, and unrelated
  failures must be repaired or isolated first.
- If the check starts green, inspect what it actually covers. Existing behavior
  is a reuse result; a refactor may use it as characterization. Tighten a weak
  check only for a demonstrated uncovered requirement. Never invent a failure
  or broaden the requirement merely to obtain RED.
- Do not refactor while red or add production behavior not demanded by the
  current check.
- Use a retained tracer bullet for the smallest real path across an uncertain
  boundary. Use a disposable spike for an unanswered feasibility question;
  label its limits before treating any result as production evidence.
- Do not add tests that mirror low-impact prose or formatting edits. Run the
  existing relevant validators instead.
- Choose required checks and a stopping condition before implementation. After
  they pass, repeat or widen only for changed inputs, a failure, or a named
  unresolved risk. Test friction calls for a smaller seam, not a new framework
  by default.
- Do not create a workflow state directory merely to narrate the loop. The
  check, test source, native reports, and concise handoff are the evidence.

Read [executable-check-contract.md](references/executable-check-contract.md)
when selecting or adapting a non-test command, qualifying a RED result, or
stabilizing the check specification.

## Workflow

1. Frame one observable behavior, invariant, or failure. Identify its current
   owner and affected consumer. Use [codebase-preflight.md](references/codebase-preflight.md)
   before implementing a proposed concept or acting on an inherited plan.
2. Choose reuse, characterization, a behavior change, or a bounded investigation.
   Reuse may complete the task without production edits. For a behavior change,
   discover the narrowest check that distinguishes current and desired behavior.
   Continue through the RED/GREEN steps below only for a demonstrated gap;
   otherwise use the selected mode's evidence and completion criteria.
3. Declare the check specification and verification boundary. Preflight dependencies
   separately when their readiness is uncertain.
   Read [isolation.md](references/isolation.md) when the check mutates the
   filesystem, depends on a service, or evaluates an agent in an untrusted task.
4. Add or tighten the smallest check before changing the implementation.
5. Run the declared command and inspect the failure. Accept RED only when it
   fails for the expected reason.
6. Implement the narrowest vertical slice that can satisfy that check. Use
   [tracer-bullets.md](references/tracer-bullets.md) when integration or feasibility
   is uncertain; do not build every layer before exercising one path.
7. Run the same check specification and accept GREEN only when it exits zero and
   its output proves the intended assertion ran. Explain cached evidence and
   skips; a green aggregate alone is insufficient.
8. Refactor while green, rerunning the focused check after each meaningful move.
9. Repeat for the next required behavior. Widen across affected contracts after
   GREEN, run mandatory repository checks, then stop when acceptance is proved.

For a behavior-preserving refactor, establish passing characterization first,
make the structural change, then rerun that same check. Report characterization,
not an invented RED. If a defect emerges, start a separate behavior-change loop.

Ask for clarification only when the acceptance boundary, critical behavior, or
risk tolerance cannot be inferred from the task and local evidence.

## Evidence And Handoff

Prefer a repository-native workflow record when one exists. Otherwise preserve:

- goal and acceptance behavior;
- current owner, evidence, reuse/extend/add/investigate decision, and unmet delta;
- check specification: working directory, exact command, assertion source,
  controlled inputs, and success criterion;
- mode: reuse, characterization, behavior change, or investigation;
- phase: `BASELINE`, `RED`, `GREEN`, `REFACTOR`, `VERIFY`, or `DONE`;
- RED evidence: exit code and the expected failure signal;
- GREEN evidence: exit code and the success signal from the same check;
- RED and GREEN checkpoint commit SHAs and push state;
- changed scope, broader verification, next behavior, and blockers.

During the loop, report only meaningful transitions: what failed and why, what
now passes, and which boundary remains unproved. Keep command results, selected
assertion counts, skips, and durations bounded; use native reports for details.

Load [handoff.md](references/handoff.md) for long-running work, interruptions,
multi-agent handoffs, or work with several red-green cycles.

## Completion Criteria

- The implementation decision follows current source and consumer evidence.
- For a behavior change, the focused check failed for the intended reason before
  implementation and the same specification now passes. For reuse or refactoring,
  passing baseline evidence is labeled accurately.
- Every validated RED and passing GREEN checkpoint was committed and pushed, or
  the missing publishable Git remote is reported.
- Refactoring, if any, happened while the focused check remained green.
- Relevant broader checks pass, or their exact residual failures are reported.
- Remaining required work prevents `DONE`; optional future work has an explicit
  trigger and does not expand the current slice.
- The handoff names exact commands and results rather than claiming confidence.

## Reference Routing

- Read [tests.md](references/tests.md) when the executable check is a behavior test.
- Read [mocking.md](references/mocking.md) when an external boundary may need a test double.
- Read [interface-design.md](references/interface-design.md) when a public code seam is hard to exercise.
- Read [deep-modules.md](references/deep-modules.md) when test friction suggests a shallow interface.
- Read [refactoring.md](references/refactoring.md) only after GREEN when choosing cleanup moves.
- Read [handoff.md](references/handoff.md) when evidence must survive interruption or transfer.
- Read [isolation.md](references/isolation.md) when a temporary directory,
  disposable worktree, service container, or containerized evaluation may be
  needed.
