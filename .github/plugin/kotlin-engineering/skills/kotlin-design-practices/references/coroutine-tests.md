# Coroutine And Flow Tests

Keep each test independent through test-local state and real coroutine components.
Do not replace production collaborators with mocks, spies, scripted stubs, or fakes.

## Test-local setup

- Use `runTest` for suspending unit tests.
- Create the real subject and its dependencies inside the test body.
- Use `StandardTestDispatcher(testScheduler)` when the component accepts a dispatcher.
- Keep every test dispatcher on that invocation's scheduler.
- Keep `TestScope`, jobs, collectors, and mutable assertions local to that invocation.
- Prohibit class fixtures, global scopes, shared clocks, and `Dispatchers.setMain` overrides.
- Keep helpers stateless with explicit arguments and fresh results.
- Use fixed inputs for pure time or randomness decisions.
- Treat the coroutine test scheduler as an explicit execution resource, never as a replacement domain collaborator.

## Scheduling and assertions

- Use `runCurrent` for work due at the current virtual time.
- Use `advanceTimeBy` to approach a deadline, then `runCurrent` for work exactly at that deadline.
- Use `advanceUntilIdle` only when the work can reach an idle state.
- Do not use wall-clock sleeps to make an assertion pass.
- Inject the dispatcher instead of hardcoding `Dispatchers.IO` or `Dispatchers.Default` in the unit under test.
- Use `backgroundScope` for long-lived collectors that the test must cancel at completion.
- Start a collector before the action when subscription order affects the contract.
- Assert `StateFlow.value` when the contract concerns current state.
- Do not demand every intermediate value from a conflated stream.
- For event streams, assert the defined order, replay, capacity, and loss behavior with real producers and collectors.
- Bound collection with a count, cancellation, or timeout. A hot stream need not complete normally.
- Exercise parent cancellation, child cleanup, finite failure, and permitted retry behavior.

Virtual time covers only dispatchers attached to that scheduler.
It does not prove thread safety, real network timing, or installed runtime behavior.
Use a separate integration test with real resources for those claims.

## Sources

- [Coroutine test library](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-test/)
- [Virtual-time endpoint semantics](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-test/kotlinx.coroutines.test/-test-coroutine-scheduler/advance-time-by.html)
- [StateFlow conflation](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-state-flow/)

The prohibition of non-local state and mock-based tests is repository policy.
It is stricter than the upstream examples that override the main dispatcher.
