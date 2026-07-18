---
name: "git-change-flow"
description: "Use when local Git work needs status inspection, user-work protection, safe branching, diff review, staging, commits, recovery, publication prep, or a defined or linked deliverable requires pull-request delivery."
---

# Git Change Flow

Use this skill for local Git process. It is intentionally host-neutral: GitHub,
GitLab, CI, and release workflows can compose it, but the skill must still be
useful in any Git repository.

## Operating Contract

- Start with `git status --short --branch` and inspect relevant diffs before
  changing version-control state.
- Treat uncommitted changes you did not make as user work. Do not revert,
  overwrite, amend, rebase, or stash them unless the user asks or the action is
  required and low risk.
- Branch before risky or publishable work when currently on a shared/default
  branch.
- A task, ticket, subtask, or direct message that defines a deliverable or links a file containing the deliverable is a publication request: use pull-request-lifecycle to raise or update the pull request and follow its latest head until green.
- Keep commits intentional: focused diff, clear message, validation evidence,
  and generated files only when they are part of the contract.
- Avoid destructive commands unless the user explicitly asked for that exact
  operation.
- Prefer non-interactive commands and report the important output in the final
  answer.

## Workflow

1. Orient.
   Check branch, remote, upstream, dirty files, ignored generated outputs, and
   whether the user asked for a commit, push, PR, only local edits, or supplied
   a deliverable that makes pull-request delivery implicit.

2. Isolate the work.
   Create or reuse an appropriate branch. Keep unrelated dirty files out of the
   change set and call out conflicts with the requested work.

3. Make and validate changes.
   Run the smallest meaningful checks for the edited surface. Broaden checks
   when shared contracts, generated outputs, or workflow files changed.

4. Review the diff.
   Use `git diff --stat`, targeted `git diff`, and `git diff --check` before
   staging. Confirm generated manifests are current when the repo owns them.

5. Stage intentionally.
   Stage only files that belong to the requested change. Use pathspecs for a
   mixed worktree. Use `git add -A` only when the whole dirty tree is in scope.

6. Commit or hand off.
   If the user requested a commit, use the repo's commit convention. Otherwise
   summarize changed files and validation, leaving the worktree uncommitted.

## Reference Routing

- Load [branch-and-commit.md](references/branch-and-commit.md) when the task
  includes branching, staging, committing, pushing, or pull request handoff.
- Load [recovery.md](references/recovery.md) before resolving merge conflicts,
  undoing a local mistake, recovering lost commits, or touching stash/reflog.

## Completion Criteria

- The final state matches the requested scope: edited, staged, committed,
  pushed, or left uncommitted as requested.
- User-owned unrelated changes were preserved.
- Diff hygiene and relevant validation were run or residual gaps are stated.
- Any published branch or PR handoff includes the branch name, commit, and
  validation evidence.
