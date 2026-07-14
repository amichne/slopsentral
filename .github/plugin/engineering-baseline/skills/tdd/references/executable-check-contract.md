# Executable Check Contract

Use this contract when RED and GREEN are proved by a shell command rather than
an assumed test-runner convention.

## Check Specification

Treat a check as one value with these fields:

```text
Working directory:
Command:
Controlled inputs and environment:
Expected RED failure:
GREEN success criterion:
```

The command alone is not its identity. Changing the working directory,
fixtures, meaningful environment variables, or arguments creates a different
check specification and breaks the direct RED-to-GREEN comparison.

Do not record secrets or an indiscriminate environment dump. Name only the
inputs that can affect the result.

## Qualifying A Check

A useful TDD check is:

- focused enough that its failure explains the next implementation slice;
- repeatable with controlled inputs;
- non-zero when the acceptance behavior is absent;
- zero only when the acceptance behavior is present;
- observational: it may create caches or temporary output, but it must not edit
  the implementation or silently repair the subject under test;
- fast enough to rerun through the focused loop.

If a raw tool does not map the target claim onto exit status, wrap it with the
smallest assertion script or existing test harness. Make a complex or reusable
wrapper a checked-in repository script rather than a fragile shell one-liner.

## Valid And Invalid RED

Valid RED proves the intended gap. Examples include a focused test assertion,
compiler diagnostic, schema rejection, linter finding, or comparison mismatch
that names the behavior being added.

Invalid RED proves only that the check cannot yet be trusted. Examples include:

- command, runtime, dependency, fixture, or configuration not found;
- malformed check syntax or a wrapper that crashes before asserting;
- timeout, permission, network, authentication, or resource exhaustion;
- a pre-existing unrelated failure hidden inside a broad command;
- flaky output that does not reproduce with controlled inputs.

Repair or isolate an invalid RED, then rerun before touching the implementation.
Never weaken the check merely to obtain GREEN.

## Shell Boundaries

- Prefer checked-in wrappers and argument arrays over shell interpolation.
- Preserve the real exit status; avoid `|| true`, accidental pipeline masking,
  and other constructs that convert failure into success.
- Use a temporary fixture or disposable worktree when RED would otherwise damage
  shared state.
- Keep setup or preflight commands separate from the check specification so a
  setup failure cannot impersonate RED.
- When a check requires external state, record that dependency and distinguish
  product failure from network, authentication, or service failure.

## Widening Rings

The focused check owns RED and GREEN. Broader commands are verification rings,
not substitutes for the missing focused failure:

1. the same focused check;
2. neighboring module or package checks;
3. repository-wide build, lint, or validation;
4. remote CI or deployment proof when the requested scope requires it.

Stop widening at the smallest ring that proves the affected surface. If a wider
ring fails for an unrelated reason, report it separately without erasing the
focused GREEN evidence.
