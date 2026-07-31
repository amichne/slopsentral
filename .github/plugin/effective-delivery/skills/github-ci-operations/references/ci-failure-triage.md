# CI Failure Triage

Use this reference when a PR check or workflow run is failing.

## Useful Commands

Run these from the repository root.

```sh
npx -y gh-axi api /user
npx -y gh-axi pr view <pr-number>
npx -y gh-axi pr checks <pr-number>
npx -y gh-axi run view <run-id>
npx -y gh-axi run view <run-id> --log-failed
python3 "<path-to-skill>/scripts/ci_wait_for_actions" --repo . arm \
  --pr <pr-number> --required --until status-change --timeout auto --json
python3 "<path-to-skill>/scripts/ci_wait_for_actions" --repo . arm \
  --run-id <run-id> --until terminal --timeout auto --json
```

Treat AXI's structured TOON response as the live evidence contract. If a
required field is absent, fail closed and update the typed parser or AXI
dependency instead of scraping human display text.

## Quiet Waiting

Use `scripts/ci_wait_for_actions` when an Actions run or PR check suite is
still pending. Arm one target, end the turn, and let the Codex hook hold the
bounded wait. The model receives only a meaningful transition, terminal state,
timeout, or error. For a non-Codex caller, invoke `await --json` once.

Never implement listening as repeated model-driven status calls. When a
`status-change` event remains pending, process it and arm a fresh baseline.

## Triage Order

1. Identify the failing check name and whether it is a GitHub Actions run.
2. Capture the run URL, job name, failing command, and concise error snippet.
3. Match the failing command to local scripts, tests, generators, or workflow
   steps.
4. Reproduce locally with the closest command.
5. Fix the owning source.
6. Re-run the local check.
7. Re-read PR checks or the run state through AXI and the typed observer before
   claiming the branch is green.

When step 7 requires waiting, do not emit status updates between unchanged
states. Report queued, in-progress, terminal pass, terminal failure, and any
timeout as separate events backed by the wait evidence.

## Failure Classes

- Product or test bug: fix code or tests and run the related suite.
- Generated drift: run the generator and commit generated outputs.
- Dependency install: inspect lockfiles, package manager setup, cache key, and
  tool versions.
- Permissions: inspect workflow `permissions`, fork PR behavior, token scopes,
  and protected environments.
- Secrets: confirm the workflow expects repository/environment secrets, but do
  not print secret values.
- Cache: check whether restore keys are hiding stale state; prefer precise keys
  tied to lockfiles.
- Flake: rerun once for evidence, then look for timing, ordering, network, or
  isolation failures before changing assertions.
- Unknown status shape: update the typed parser or AXI contract rather than
  downgrading to display-output parsing.

## Reruns

- Rerun failed jobs only after deciding whether the failure might be flaky.
- Prefer `npx -y gh-axi run rerun <run-id> --failed` for a suspected transient
  failure.
- Do not use reruns as the only fix for deterministic failures.
