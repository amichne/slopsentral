# Errors And Testing

Use for expected failures, typed outcomes, and correctness-focused tests.

## Finite failures

- Represent expected domain failures as operation-specific sealed outcomes with case-specific data.
- Reuse an existing outcome when it preserves every caller obligation and failure identity.
- Do not default to Kotlin `Result`, `Throwable`, null, or Boolean for finite domain failures.
- Translate documented adapter exceptions once into the domain outcome.
- Preserve unknown faults and cancellation. Do not convert them into success or a generic domain failure.
- Handle each closed outcome exhaustively without an `else` branch.

Kotlin `Result` can remain at an external API that mandates it.
Translate that representation before a domain consumer needs a finite failure identity.

- Keep meaningful absence distinct from failure: a successful search with no
  match is not a transport outage. Use named cases and non-null payloads, not
  `T?`, `getOrNull`, `getOrDefault`, or success-shaped fallback values.
- Catch only documented expected adapter failures. Preserve interruption and
  avoid broad `runCatching` around suspending operations.
- Mapping preserves failures; recovery must name which cases it handles.
- Check a valid value, meaningful absence, and an operational failure separately.
  Verify a newly added sealed case breaks an incomplete consumer, rather than
  relying only on happy-path runtime tests.

## Local state and real behavior

- Create the subject, inputs, collaborators, scheduler, and collectors inside each test invocation.
- Prohibit non-local test state, including instance fields, companion objects, singletons, and shared setup fixtures.
- Keep helper functions stateless. Pass their inputs explicitly and return fresh values.
- Use real production components. Do not use mocks, spies, scripted stubs, or fake collaborators.
- Assert results and public state changes. Do not assert a scripted interaction in place of behavior.
- Pass fixed time or random inputs into pure decisions instead of reading ambient services.
- Use a separate integration test for filesystem, process, network, or database behavior.
- Give each integration test its own real resources and bounded cleanup.
- Cover valid input, rejection, state transitions, order, idempotence, compatibility, and cancellation.
- Add one tracer bullet at a time. Do not add tests only to raise coverage.

The local-state rule prohibits `Dispatchers.setMain`, even with teardown.
Pass a test-owned dispatcher to the real component instead.
Read [coroutine tests](coroutine-tests.md) for scheduler and Flow assertions.
