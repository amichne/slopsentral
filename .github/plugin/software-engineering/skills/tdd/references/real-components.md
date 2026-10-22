# Real Components And Local State

Use real production components and explicit input values in unit tests.
Prohibit mocks, spies, scripted stubs, and fake collaborators as substitutes for production behavior.
Assert public results and state changes instead of scripted interactions.

Each unit-test invocation owns its subject, inputs, collaborators, scheduler, and mutable assertions.
Prohibit non-local state in instance fields, shared setup fixtures, singletons, global clocks, and dispatcher overrides.
Keep helpers stateless with explicit inputs and fresh results.

Pass fixed values into pure decisions when time or randomness affects the result.
Use real library schedulers when scheduling is the mechanism under test.
Keep every scheduler and coroutine scope local to the test invocation.

For external effects, use a separate integration test with real resources.
Use test-owned temporary directories, loopback services, databases, or subprocesses.
Bound their lifetime and cleanup. Do not depend on public services for a deterministic local test.
If the real dependency is unavailable, report the missing evidence instead of substituting a mock result.

Choose the smallest faithful mechanism. A pure unit test does not need a running service.
An adapter integration claim needs the real adapter and its external protocol.
