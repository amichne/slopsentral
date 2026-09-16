# Pipeline Review

A useful design names the release unit, stage graph, immutable artifact identity,
trust transitions, required checks, rollout criteria, recovery path, and ownership.
Use a diagram only when it makes a dependency or boundary clearer.

For each edge, ask what evidence the next stage receives and whether it proves
the claim required there. A green source test is not an image scan. A cached build
output is not a signed release. A successful upload does not prove rollout health.

Keep validation jobs cancelable when superseded if safe. Treat deployment
cancellation separately: interruption may leave a partially changed environment.
Queue or serialize deployment to a shared target when competing writes would race.

Path filters can prevent a required check from reporting. Validate no-change,
docs-only, fork, merge-queue, and release events relevant to the repository.
A reusable workflow is justified by a shared contract, not by reducing YAML lines.

Avoid selecting vendors from arbitrary user-count tiers or imposing a single
branching model. Start from the project's runtime, authority, risk, and evidence.
Measure lead time and failure behavior against the project's actual baseline.
