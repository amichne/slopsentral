# Test And Evaluation Isolation

Choose the lightest boundary that makes the focused check repeatable. Isolation
belongs around the subject under test; it is not a reason to make the agent write
parallel task descriptions, command scripts, or proof logs.

## Decision Table

| Boundary under test | Preferred isolation | Durable authority |
|---|---|---|
| Pure Kotlin behavior | Normal unit test | Test source and runner result |
| Filesystem behavior | Test-owned temporary directory | Test assertions |
| Gradle plugin or build logic | Gradle TestKit project in a temporary directory | Functional test and task outcome |
| Database, broker, or network service | Testcontainers or an equivalent lifecycle-managed fixture | Integration test and container configuration |
| Repository-wide agent task | Disposable Git worktree or copied fixture | External verifier and resulting diff |
| Untrusted or environment-sensitive agent evaluation | Per-sample container with bounded resources and network policy | Dataset sample, sandbox definition, scorer, and evaluation log |

Do not add Docker to a fast deterministic unit or compile check. A container
controls environment and effects; it does not improve a vague acceptance test.

## Stable Tracer Bullet

One tracer-bullet cycle has one check specification:

1. Add the smallest check that expresses the desired public behavior.
2. Run it in the isolated fixture and observe the intended non-zero failure.
3. Change production code without changing the check specification.
4. Run the same check and observe zero.
5. Refactor while it remains green, then widen only across affected contracts.

If setup changes the implementation, repairs the subject, or determines whether
the assertion runs, it is part of the test and must be controlled. Dependency
download, image build, authentication, and fixture provisioning failures are
infrastructure failures, not RED.

## Containerized Agent Evaluation

Keep agent execution and scoring separate:

- The harness provisions a fresh repository state and container per sample.
- The task supplies the prompt, controlled files or setup, limits, and allowed
  capabilities.
- The agent changes only the disposable workspace.
- An external scorer runs deterministic repository-native checks and inspects
  the diff after the agent stops.
- The harness owns transcripts, timing, exit status, and cleanup.

This structure constrains wandering more effectively than asking the model to
self-report phases: the environment limits effects, the scorer owns success,
and the model cannot manufacture a passing evaluation record.
