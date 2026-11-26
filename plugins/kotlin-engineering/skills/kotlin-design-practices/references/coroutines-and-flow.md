# Coroutines And Flow

Use this reference for Kotlin JVM concurrency and stream contracts.
Examine the repository's coroutine version before a version-specific API choice.

## Lifetime and outcomes

- Prefer a suspending operation when completion belongs to the caller.
- Use `coroutineScope` for child work that must complete before the operation returns.
- Use `supervisorScope` only when independent child failures match the contract.
- Give long-lived work one explicit scope owner with a cancellation and completion path.
- Prohibit `GlobalScope`, detached jobs, and unowned collectors.
- Distinguish work accepted from work completed. Do not report completion from `launch` alone.
- Pass dispatchers to effect adapters. Keep blocking work outside CPU dispatchers and pure decisions.
- Preserve `CancellationException`. Do not swallow it with broad catches or `runCatching` around suspending work.
- Keep cleanup in `finally` or `use`. Limit `NonCancellable` to bounded cleanup that needs suspension.
- Define sibling failure, parent cancellation, and child completion behavior before implementation.

Use closed data for expected domain failures.
An emitted failure value does not automatically cancel sibling coroutines.
Choose that coordination policy explicitly and cover it with a focused test.

## Stream contract

- Declare whether a stream is cold or hot and whether it can complete.
- Keep mutable producers private. Expose `Flow`, `StateFlow`, or `SharedFlow` through the owning API.
- Give `stateIn` and `shareIn` an explicit owner, start policy, and replay contract.
- Use `StateFlow` for current state. Its equality-based conflation does not preserve every intermediate event.
- Define `SharedFlow` replay, capacity, overflow, and behavior without subscribers.
- Select buffering, conflation, and latest-value operators from permitted loss and cancellation behavior.
- Preserve every event when the contract forbids loss. Do not add `conflate` or `collectLatest` as generic optimizations.
- Preserve Flow context rules. Use `flowOn` for upstream work instead of a different context around `emit`.
- Keep `catch` scoped to documented upstream failures. Preserve downstream failures and cancellation.
- Bound retry count and delay. Admit retries only when the operation's effect contract permits them.
- Release callback registrations with `awaitClose` when a callback adapter owns them.

## Evidence

Cover normal completion, rejection, cancellation, cleanup, and the selected loss or replay policy.
Use real producers and collectors. Read [coroutine tests](coroutine-tests.md) for test-local scheduling.
A single-threaded virtual scheduler does not prove freedom from races on real threads.
Use a focused integration or concurrency test when that claim matters.

## Sources

- [Coroutine basics](https://kotlinlang.org/docs/coroutines-basics.html)
- [Structured operation scope](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/coroutine-scope.html)
- [Supervision](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/supervisor-scope.html)
- [Flow contracts](https://kotlinlang.org/docs/coroutines-flow.html)
- [StateFlow](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-state-flow/)
- [Flow exception handling](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/catch.html)
