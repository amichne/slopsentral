# Event-Driven GitHub Actions Observation

Use this reference when a run or PR check is pending. The observer keeps
unchanged remote states inside one bounded process, so the model resumes only
when it has new information to process.

## Arm One Event

Choose a concrete target and predicate:

```sh
python3 "<path-to-skill>/scripts/ci_wait_for_actions" --repo . \
  arm --run-id <run-id> --until status-change --timeout auto --json

python3 "<path-to-skill>/scripts/ci_wait_for_actions" --repo . \
  arm --pr <pr-number> --required --until terminal --timeout auto --json
```

- `status-change` resumes on the first meaningful change in run, job, or check
  state. Process that event once, then re-arm if the new state is still pending.
- `terminal` stays asleep through intermediate changes and resumes only for
  success, failure, timeout, or error.
- `--required` uses AXI's authenticated GraphQL API path to keep only checks
  marked required for that PR.

Only one request may be active per Git repository. The arm result records the
target, baseline, predicate, expiry, resolved timeout, timeout source, and local
state path.

## Yield Instead of Listening

After a successful arm, end the Codex turn. The plugin's `Stop` hook sees the
active request, runs one `await`, and blocks the turn from ending until the
predicate or bound is reached. It then returns one compact continuation with
the previous and current state.

If the hook is unavailable, invoke `await --json` once. Do not run status or
remote snapshot commands in a manual loop. `status --json` is local-only and is
for recovery or inspection, not listening.

The observer retries at most two transient AXI read failures. A third
consecutive error wakes the model instead of waiting indefinitely.

## Timeout Selection

Prefer `--timeout auto` and inspect the arm result before yielding. Selection
uses, in order:

1. a repository-owned `.axi/github-actions-duration-profile.json` group with at
   least five matching workflow samples;
2. clone-local matching run history under the Git metadata directory;
3. a 1800-second default when no eligible samples exist.

With one to four samples the bound is twice the longest duration plus 60
seconds. With five or more it is p95 times 1.5 plus 60 seconds. Results are
clamped to 300 through 3300 seconds; explicit invocation values may be 30
through 3300 seconds.

Cancelled, startup-failure, and action-required runs do not influence automatic
timeout selection. Inspect current knowledge with:

```sh
python3 "<path-to-skill>/scripts/ci_wait_for_actions" --repo . \
  profile show --json
```

When the team wants portable timing knowledge, explicitly export and review it:

```sh
python3 "<path-to-skill>/scripts/ci_wait_for_actions" --repo . \
  profile export --output .axi/github-actions-duration-profile.json --json
```

Do not commit the clone-local active request or raw history. Commit an exported
profile only when the repository wants that shared policy.

## Evidence and Recovery

Runtime files live beneath `git rev-parse --git-path axi/github-actions`:

- `active.json` is the single armed request;
- `last-observation.json` is the latest transition, terminal event, or timeout;
- `history.jsonl` contains observed terminal run durations.

The active request is cleared before the model resumes. A malformed active file
is quarantined instead of trusted. Terminal run failure logs are fetched once
through `npx -y gh-axi run view <run-id> --log-failed` after classification.

The hook loads AXI's repository context at session start and injects a
non-exported shell function into each shell call so ordinary `gh` invocations
resolve to `npx -y gh-axi`. Explicit CLI paths, `env ... gh` bypasses, and
GitHub MCP tools are denied. This is a defense-in-depth boundary, so authored
commands must still use `npx -y gh-axi`; local `git` remains the authority for
repository metadata.
