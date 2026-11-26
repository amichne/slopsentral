# Worktrunk Automation

Worktrunk owns CLI worktree lifecycle and executes repository-owned hooks.
The upstream `worktrunk` skill owns its configuration and command reference;
this procedure connects those capabilities to local task scope and evidence.
Read installed command help when options differ from these examples.

## Establish Ownership and the Base

1. Inspect `git status --short --branch`, `git worktree list --porcelain`, the
   selected remote, and applicable repository instructions. Reuse a suitable
   checkout when the task already has one.
2. For a host-managed checkout, use the host's worktree creation, attachment,
   handoff, and archival tools. Worktrunk can inspect it, but must not relocate
   or remove it behind the host's back. A shell directory change does not move
   the host's session.
3. For a new CLI-owned worktree, fetch the requested remote base, resolve its
   full commit, then give that commit to Worktrunk. For a repository whose base
   is `origin/main`:

   ```sh
   git fetch origin main
   git rev-parse --verify 'origin/main^{commit}'
   wt switch --create <task-branch> --base <resolved-commit> --no-cd --format=json
   ```

   Respect an explicitly requested alternative base. Do not infer that a local
   default branch is current. Read the structured result and verify the new
   checkout's `HEAD` against the resolved commit. Use its actual absolute path
   as the working directory for later tools. Existing dirty files, detached
   commits, stashes, and unrelated branches stay preserved.

## Put Repetition in Project Hooks

Read the existing `.config/wt.toml` and `wt hook show --expanded` first. Derive
commands from the repository's package scripts, mise tasks, and required checks;
keep the canonical verification command callable without Worktrunk.

| Requirement | Worktrunk boundary | Completion evidence |
| --- | --- | --- |
| Dependencies needed before work | `pre-start` | Setup completed in the new checkout before handoff |
| Quick checks before a Worktrunk commit | `pre-commit` | Check failure aborts the commit |
| Verification after rebase before local integration | `pre-merge` | Relevant checks completed at the resulting commit |
| Optional server or watcher | `post-start` | Explicit readiness signal; background launch alone proves no readiness |

Independent table entries run concurrently. Use Worktrunk hook pipelines when
one command depends on another. Test failure as well as success in a disposable
repository. A failed setup can leave the new worktree present; inspect and
report it instead of launching the agent or automatically deleting it.

Project hook approval belongs to the host/user's trust boundary. Existing
authorization for reviewed commands remains valid; inspect the exact expanded
commands before applying it. Do not auto-approve unknown project or user hooks,
skip a required gate with `--no-hooks`, or treat a skipped hook as passing.
Worktrunk hooks apply to Worktrunk operations; raw `git commit` does not run
them. Run the canonical check explicitly when using raw Git or host tools.

## Preserve Staging and Delivery Scope

Stage only the task's paths, inspect the index, then use
`wt step commit --stage=none` when a Worktrunk commit is authorized. Its default
staging mode includes all changed and untracked files. The commit-message
generator is a separately configured capability; retain an existing working
configuration and inspect the resulting message and diff.

`wt merge` combines commit, squash, rebase, local integration, and cleanup.
Invoke it only when that entire local sequence is authorized. Its `step push`
updates a local target branch; it is not a remote publication command. Use the
existing pull-request-lifecycle procedure for authorized remote push, PR, and
exact-head CI checks. Hook success does not establish hosted CI success.

Launch another agent with `wt switch ... --execute <agent>` only when the user
authorized that session. Required `pre-start` setup must pass first. Remove a
CLI worktree only under the task's cleanup authority after checking dirty,
ignored, detached, and unpushed work. Use the host's archive operation for
host-managed worktrees.

## Sources

Reviewed 2026-10-06 against `wt v0.53.0` and
[max-sixty/worktrunk at dea4029c593a89a39fb141da9d0849e4d10dae19](https://github.com/max-sixty/worktrunk/tree/dea4029c593a89a39fb141da9d0849e4d10dae19).
The upstream plugin and its MIT OR Apache-2.0 notices remain upstream-owned;
no plugin payload or skill files are copied here. Command and hook behavior
should be reacquired from the installed version when changing automation.
