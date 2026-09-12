# Tracer Bullets And Spikes

A tracer bullet is a small production path retained as the system grows. TDD
is the feedback loop used to build a behavior on that path. A spike is a
disposable experiment that answers a bounded feasibility question. They solve
different problems and do not require different test frameworks.

## Pick The First Slice

Choose the cheapest slice that resolves the largest relevant uncertainty.
Name the caller, real boundary, observable result, and rejection behavior.
Implement one path through the necessary layers, then exercise it before
expanding. Building all schemas, all services, and all adapters first postpones
the evidence that they work together.

| Uncertainty | First useful proof | Limit |
|---|---|---|
| A forbidden operation remains reachable | Compiler fixture rejecting misuse, with a valid-call control | Does not prove runtime integration |
| A producer's token can be resumed by a consumer | Production encoder → advertised output schema → advertised input schema → decoder | Does not prove a live host emits that result |
| A settled read failure leaks into workspace recovery | Deterministic adapter test with queued/later requests and uncertain-mutation controls | Does not establish a historical incident's missing payload |
| Plugin installation selects the right archive | Temporary filesystem fixture and archive metadata/checksum assertions | Does not prove IntelliJ loads or runs the plugin |
| A platform API actually works in the host | One bounded run in the real host | Does not justify adding a slow host suite to every CI run |

Exercise pure rules through small deterministic checks. Add a boundary check
only for what those rules cannot prove. An integration-style assertion can live
inside one module; it need not boot the application. Conversely, a mocked host
cannot establish host compatibility.

## Keep The Oracle Honest

- Derive expected results from the requirement or an independently authored
  fixture. Do not compute them with the same production algorithm being tested.
- Prove identities and content where counts could hide substitution or replay.
- Add the nearest counterexample that defeats a plausible wrong fix: malformed
  input, wrong authority, replayed continuation, or uncertain termination.
- Freeze each check's command, assertion source, fixture, and meaningful
  environment through RED/GREEN. New assertions start new evidence; do not
  retrospectively attribute their coverage to an earlier failure.
- If the first real boundary fails opaquely, add bounded stage/outcome evidence
  at that effect boundary, with success and failure checks. Keep payloads and
  secrets out of diagnostics.

## Bound A Spike

State the question, permitted effects, effort bound, and the observation that
will decide the next step. Use a disposable fixture when possible. Stop when
the question is answered or the bound is reached; retain the finding and its
limits. Promote useful code only after applying the production contract and
its checks. Do not turn experimental fallback behavior into a permanent API.

## Stop With The Slice Complete

Before implementation, name the focused check, affected consumer checks,
mandatory repository checks, and any required runtime or packaging proof.
After they pass, additional checks need a concrete new risk or changed input.
Record optional ideas with the condition that would justify them; do not build
them now. No arbitrary test count, elapsed-time quota, or confidence percentage
can replace the required evidence.
