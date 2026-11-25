---
name: "pull-request-lifecycle"
description: "Use when asked to push a branch, open or update a pull request, manage stacked PRs, or follow PR checks to completion. Also applies when repository policy requires PR delivery. Use git-change-flow for local edits and github-ci-operations for CI repair."
---

# Pull Request Lifecycle

Use the GitHub CLI (`gh`) for GitHub operations and local `git` for the
worktree, index, and commits. Check the account with `gh auth status`.
Outside a checkout, pass `--repo OWNER/REPO` to `gh pr` commands.

Before local Git changes, use `git-change-flow` for branch, staging, and recovery
decisions. When inspecting checks or repairing CI, use `github-ci-operations`
for the affected workflow and observation procedure.

## Operating Contract

- For work in a checkout, start with the nearest repo instructions and
  `git status --short --branch`. A remote status request can resolve the PR
  directly without creating a checkout.
- Treat unrelated dirty files as user work. Do not stage, stash, rebase, amend,
  or overwrite them unless the user asks for that exact operation.
- Branch before commit-worthy work when currently on `main`, `master`, `trunk`,
  or another shared branch.
- Derive publication authority from the requested end state or applicable repository policy. A task description, ticket, or linked deliverable alone does not authorize publication. Preserve explicit local-only scope; do not request permission again for publication already authorized.
- Run the narrowest local validation that corresponds to the changed surface
  before pushing.
- Open PRs from the actual head branch and target the nearest intended base, not
  `main` by reflex when a stacked branch is visible.
- Do not mark a PR ready for review until the branch has a focused diff,
  validation evidence, and no known deterministic failures.
- Babysit checks by reading live check state, logs, and annotations. For
  pending GitHub Actions runs, use the observer exposed by
  `github-ci-operations` when available, or structured `gh pr checks` reads at
  meaningful transitions. Fix the owning source instead of rerunning
  deterministic failures.
- Never claim a PR is green until the typed required-check observation reports
  passing, skipped, or neutral terminal states for the current head.

## Workflow

1. Orient.
   Identify the current branch, upstream, base branch, changed files, existing
   PR number if any, and requested end state: local branch, pushed branch, draft
   PR, ready PR, or green PR. Read linked material as context and acceptance
   criteria; do not infer a publication request from the existence of a deliverable.
   Reuse the existing branch and PR when they own the requested work.
   For observation alone, continue at check inspection. For local-only edits
   or commits, use `git-change-flow` without entering publication steps.

2. Isolate the branch.
   For dependent branches, follow **Stacked pull requests** below. For a single
   PR, if the task is publishable and the checkout is on a shared branch, create a
   focused topic branch. If unrelated dirty files exist, keep staging and diffs
   path-specific.

3. Validate locally.
   When delivering source changes, run the narrowest command that proves the changed behavior. For Kotlin or
   Gradle changes, prefer `./gradlew :module:test`, `./gradlew :module:check`,
   or the repository's checked-in wrapper before broad `check`.

4. Commit and push.
   When delivering changed files, stage only files in scope. Run
   `git diff --cached --check` and commit with the repository's convention.
   When a push is authorized, push the branch with upstream tracking as needed.
   An already committed branch needs no artificial follow-up commit.
   If the requested end state is a pushed branch, report it without opening a PR.

5. Open or update the PR.
   Use `gh pr list` to find an open PR for the intended head and base.
   Inspect its revision and review state with `gh pr view`.

   ```sh
   gh pr list --head <branch> --base <base> --state open --limit 2 \
     --json number,url,headRefName,baseRefName,state,isDraft
   gh pr view <pr-number> \
     --json number,url,headRefOid,baseRefName,state,isDraft,reviewDecision
   ```

   If no matching PR exists and creation is in scope, use
   `gh pr create --base <base> --head <branch> --title <title> --body-file <file>`.
   Include the purpose, changes, validation, and residual risk. Add `--draft`
   for a draft. Use `gh pr edit` when an existing PR needs a metadata change.

6. Watch checks.
   When checks are requested or support a readiness claim, confirm the PR and
   head SHA with `gh pr view`. Read the required checks with:

   ```sh
   gh pr checks <pr-number> --required \
     --json bucket,link,name,state,workflow
   ```

   When checks are pending and the local observer is available, run `uv run --locked --script
   "<path-to-github-ci-operations-skill>/scripts/ci_wait_for_actions" --repo .
   arm --pr <pr-number> --head-sha <published-head-sha> --required --until terminal --timeout auto
   --json`, then invoke the same script with `--repo . await --json`.
   Zero checks stay pending. A changed head returns an error.
   After a timeout, use `resume --timeout auto --json` before `await --json`.
   Renewal keeps the original target and head SHA.
   For failing Actions runs, read the logs with `gh run view <run-id> --log-failed`.
   An unavailable local observer does not block the PR handoff. Separate
   product or test failures, generated drift, dependency setup, permissions,
   secrets, cache, and flaky behavior.

7. Repair or hand off.
   When repair is in scope, fix deterministic failures at their owning source,
   rerun the local equivalent, push the authorized change, and re-read checks.
   For observation alone, report the failure and its evidence without changing
   the branch. For pending checks, report
   the pending names and URLs. For external or inaccessible checks, state the
   exact signal that could not be verified.

## Stacked pull requests

Use the `github/gh-stack` extension for a chain of dependent PRs. Check
`gh stack --help` for the installed commands. A single PR uses built-in `gh pr`.

- For a new stack, run `gh stack init --base <trunk> <bottom> <top>`.
  List branches from base to tip. Inspect an existing stack with
  `gh stack view --json` and add a new top branch with `gh stack add <branch>`.
- Validate each branch against its immediate base. For local preparation,
  stop after the requested branches and commits exist.
- When publishing the entire stack is authorized, use `gh stack submit`.
  It pushes the branches, creates draft PRs by default, and can retarget
  existing PRs. For a branch-only push, push just the named branch with Git.
- Confirm each published PR's base and head with `gh pr view`. Check each
  head separately when reporting CI for the stack.

## Check Green Loop

When addressing review feedback, first validate each claim against the current PR revision
and an executable oracle. Repair only mechanically supported findings, then
re-review the changed boundary. After a push, reacquire the head SHA and terminal
required checks. A passing local repair or a review of the previous revision
does not prove the current PR is ready.

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
- Local validation for changed source was run or the missing tool/environment is named.
- When check status or readiness is part of the result, remote checks were read
  for the current head after any push, and green claims are backed by
  structured check state rather than expectation.
- The requested publication scope is satisfied. When green checks are requested,
  evidence refers to the latest PR head; otherwise report pending checks accurately.
