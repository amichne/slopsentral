---
name: "pull-request-lifecycle"
description: "Use when work needs a branch, commit, push, PR, check babysitting, CI repair, or when a task, ticket, subtask, or direct message defines or links a deliverable that must be delivered through a green PR."
---

# Pull Request Lifecycle

Use this skill to carry code work across the version-control boundary without
losing evidence. It composes local Git hygiene, GitHub PR operations, and CI
triage; it must remain useful even when a host-specific GitHub connector is not
available. Use the connected GitHub app for supported PR operations. Use
authenticated native `gh` only for GitHub Actions, logs, the local CI observer,
or a connector gap. Use local `git` for local repository state.

Related primitives in this repository:

- `skills/git-change-flow`
- `skills/github-ci-operations`

## Operating Contract

- Start by reading the nearest repo instructions and `git status --short
  --branch`.
- Treat unrelated dirty files as user work. Do not stage, stash, rebase, amend,
  or overwrite them unless the user asks for that exact operation.
- Branch before commit-worthy work when currently on `main`, `master`, `trunk`,
  or another shared branch.
- When a task, ticket, subtask, or direct message defines a deliverable or links a file containing the deliverable, raise or update a pull request and follow its latest head until green.
- Run the narrowest local validation that corresponds to the changed surface
  before pushing.
- Open PRs from the actual head branch and target the nearest intended base, not
  `main` by reflex when a stacked branch is visible.
- Do not mark a PR ready for review until the branch has a focused diff,
  validation evidence, and no known deterministic failures.
- Babysit checks by reading live check state, logs, and annotations. For
  pending GitHub Actions runs, arm the observer from
  `skills/github-ci-operations/scripts/ci_wait_for_actions`, then invoke one
  bounded `await --json`. Fix the owning source instead of rerunning
  deterministic failures.
- Never claim a PR is green until the typed required-check observation reports
  passing, skipped, or neutral terminal states for the current head.

## Workflow

1. Orient.
   Identify the current branch, upstream, base branch, changed files, existing
   PR number if any, and requested end state: local branch, pushed branch, draft
   PR, ready PR, or green PR. A defined or linked deliverable defaults the end
   state to a green PR.

2. Isolate the branch.
   If the task is publishable and the checkout is on a shared branch, create a
   focused topic branch. If unrelated dirty files exist, keep staging and diffs
   path-specific.

3. Validate locally.
   Run the narrowest command that proves the changed behavior. For Kotlin or
   Gradle changes, prefer `./gradlew :module:test`, `./gradlew :module:check`,
   or the repository's checked-in wrapper before broad `check`.

4. Commit and push.
   Stage only files in scope. Run `git diff --cached --check`, commit with the
   repository's convention, then push the branch with upstream tracking when
   publication is requested.

5. Open or update the PR.
   Use the connected GitHub app to detect, inspect, create, or update the PR.
   If the connector lacks an operation, use:

   ```sh
   gh pr list --head <branch> --state open --limit 2 \
     --json number,url,headRefName,baseRefName,state,isDraft
   gh pr view <pr-number> \
     --json number,url,headRefOid,baseRefName,state,isDraft,reviewDecision
   ```

   Open the PR with purpose, changed surface, validation evidence, and residual
   risk. Prefer draft until local evidence is complete.

6. Watch checks.
   Confirm the PR and head SHA through the connected GitHub app. For a native
   Actions snapshot, use:

   ```sh
   gh pr checks <pr-number> --required \
     --json bucket,link,name,state,workflow
   ```

   When checks are pending, run `python3
   "<path-to-github-ci-operations-skill>/scripts/ci_wait_for_actions" --repo .
   arm --pr <pr-number> --required --until status-change --timeout auto
   --json`, then invoke the same script with `--repo . await --json`. For
   failing Actions runs, use `gh run view <run-id> --log-failed`. Separate
   product or test failures, generated drift, dependency setup, permissions,
   secrets, cache, and flaky behavior.

7. Repair or hand off.
   For deterministic failures, patch the owning source, rerun the local
   equivalent, push a new commit, and re-read checks. For pending checks, report
   the pending names and URLs. For external or inaccessible checks, state the
   exact signal that could not be verified.

## Check Green Loop

When asked to babysit until green:

1. Arm a transition-only observation and invoke one bounded `await --json`.
   Emit one update only when the remote check or run state changes.
2. Treat `failure`, `cancelled`, `timed_out`, and required `action_required` as
   stop conditions that need diagnosis.
3. Treat `pending`, `queued`, and `in_progress` as wait states only while the
   run is still moving. Re-arm after processing a pending transition.
4. Stop and report if the same blocking condition recurs after three repair
   attempts or if a required secret, permission, or environment approval is not
   available locally.

## Evidence To Report

Report:

- branch name, base branch, PR number or URL, and head SHA;
- files staged or intentionally left unstaged;
- local validation commands and outcomes;
- remote check names, states, and failing run URLs when relevant;
- what remains pending or externally blocked.

## Completion Criteria

- The requested branch, commit, push, PR, or ready-for-review state exists.
- User-owned unrelated work remains untouched.
- Local validation was run or the missing tool/environment is named.
- Remote checks were read after the latest push, and green claims are backed by
  structured check state rather than expectation.
- Work with a defined or linked deliverable has a pull request whose latest head
  is green.
