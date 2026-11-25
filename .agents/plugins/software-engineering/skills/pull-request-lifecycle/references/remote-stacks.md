# Adopt and land a remote stack

## Reuse the published branches

Fetch the intended remote. Record each branch's head SHA and any open PR's
number, head repository, head branch, and base. Confirm the dependency order
from the changes and Git history. Similar branch names or simultaneous builds
alone do not establish a stack.

- **Already linked on GitHub.** Run `gh stack checkout <pr-number>` to fetch
  the stack and set up local tracking. Inspect the order with `gh stack view --json`.
- **Existing PRs, not yet linked.** When linking is authorized, run
  `gh stack link --base <trunk> <bottom-pr-number> <top-pr-number>`, including
  every intermediate PR in order. Use verified PR numbers to reuse the open PRs.
  Linking can change their bases. Inspect membership and each PR's base afterward,
  including after a partial failure. Use `gh stack checkout <pr-number>` for local work.
- **Published branches without PRs.** Create local tracking branches at the
  fetched tips with `git branch --track <branch> <remote>/<branch>` where
  needed. Check existing local branches for divergence first. Adopt the branches
  bottom to top with `gh stack init --base <trunk> <bottom> <top>`. When PR
  publication is requested, `gh stack submit` reuses open PRs and creates
  missing ones. Branch arguments to `gh stack link` can also push and create PRs.

## Batch changes before the next build

If the chain is already linear against the current trunk, keep its published
heads and reuse their current checks. When a lower layer or trunk moves,
finish related edits locally and run `gh stack rebase` once across the stack.
For conflicts, resolve and use `gh stack rebase --continue`, or restore the stack
with `gh stack rebase --abort`.

Verify each parent is an ancestor of its child with
`git merge-base --is-ancestor <parent> <child>`. Review each layer's diff and
run the affected checks. Compare remote heads with the SHAs recorded before
the rebase. If a collaborator has pushed, reconcile their changes first.
When publishing rewritten branches is authorized, use one leased, atomic push
for the stack (`gh stack push`). Refresh PR and CI evidence for changed heads.
This avoids scheduling intermediate revisions. A push can still trigger CI
for every changed PR.

## Land the full stack

Once a whole-stack merge is authorized, confirm GitHub's ordered membership,
the top PR and its exact head SHA. Verify the required checks and approvals for
every layer against the current heads. Submit **one** stack merge request on
the top PR. GitHub includes every unmerged layer below it. Squash produces one
commit per PR on trunk. If the requested result is exactly one commit total,
prepare one combined PR against trunk and validate its complete diff and head.

Use GitHub CLI against the [asynchronous merge endpoint](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request-asynchronously).
For a direct squash merge where no queue is required, run:

```sh
gh api --method PUT repos/OWNER/REPO/pulls/TOP_PR/merge-async \
  -f sha=TOP_HEAD_SHA -f merge_method=squash -f merge_action=direct_merge
```

For a required merge queue, verify the queue uses squash, then send the same
request with `-f sha=TOP_HEAD_SHA -f merge_action=merge_queue`. Omit
`merge_method` because the queue controls it. If the queue uses another method,
report the mismatch before submitting.

Follow the returned request UUID to its result. An enqueued result confirms
queue admission. Verify every intended PR is merged and its merge commit is
reachable from the fetched trunk before reporting that the stack landed.
GitHub documents the [stack merge and queue rules](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests).
