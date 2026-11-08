# Maintain scoped instructions

The `agents-md-scope` hook requests instruction maintenance after Git changes.
It groups task changes by instruction scope and refreshes changed instructions only where they apply.
The agent must examine the source before it changes instructions.

Shared rules belong in the ancestor that owns them.
The agent creates a child `AGENTS.md` only when source evidence supports a local difference.
Commands, source ownership, generated files, and local rules can justify that difference.
The hook does not create placeholder files or copy parent rules into children.

## Events and review

`UserPromptSubmit` establishes the first baseline without a review obligation for preexisting edits.
Later prompts and `Stop` compare actual Git changes against the previous snapshot.
Changes include untracked files, renames, deletions, committed edits, and edits from external tools between events.
The comparison includes changes from failed tools.

Source changes from a proven remote refresh create no task review obligation.
The hook keeps a hash and length of the worktree's HEAD reflog at each snapshot.
It accepts a later checkout, reset, or fast-forward only when the recorded transitions form an unbroken chain to a remote-backed commit.
A local commit in that chain keeps the source review, even after a push.
Missing, expired, rewritten, or unsupported history keeps the full source review.
Older state without a reflog checkpoint also keeps that conservative behavior for its next HEAD change.

Remote refreshes preserve pending reviews and new local edits.
Unchanged preexisting edits create no new obligation.
Clean instruction changes from a proven remote refresh update context without creating a review obligation or an automatic repair turn.
Local instruction edits still need review, even when they occur during a remote refresh.
Global instruction changes and uncertain HEAD changes also retain their review.

The hook fingerprints `AGENTS.md` and `AGENTS.override.md` in the repository, its ancestors, and the host's global instruction directory.
Fingerprinting does not put every guide into model context.
Changed instruction text is delivered only for ancestors of the working directory, pending local scopes, or paths supplied by the host.
Other changed guides remain queued until their scope is used.
Pi supplies successful `read`, `edit`, and `write` paths for the current user task at the next hook boundary.
It does not guess paths from shell commands or run a hook subprocess after every tool.
Those operations rely on the working directory and Git changes for scope detection.

Each refresh emits at most 8 KiB and does not repeat unchanged instruction text.
Oversized guides are referenced rather than truncated; remaining guides stay queued.
Review summaries use at most 4 KiB, group paths by their instruction owner, and show up to three examples per group.
The `status` command exposes the full path inventory on demand.
A changed guide no longer triggers a blanket descendant review.
Review only descendants affected by a changed rule, not by timestamps or other metadata.
The hook rejects instruction symlinks and keeps source payloads outside diagnostic logs.
Generated Slopsentral projections under `.agents/plugins` and `.github/plugin` stay with their authored owners.

`Stop` blocks completion only when a maintenance review remains pending.
The Pi adapter permits one automatic repair continuation per user request; context-only refreshes do not request one.
The response contains exact `status` and `review` commands for that repository and session.
The agent replaces the sample note with its source-backed result.
A no-change result is valid when the existing instructions still describe the source.
Later source edits create a new review obligation.

## Install on this computer

The Software Engineering plugin composes the canonical hook.
The repository also declares the hook in `.codex/hooks.json`.
Both use the same repository-and-session state, so duplicate events do not create duplicate obligations.

For a global installation from an unpublished checkout, use the explicit installer:

```sh
uv run --locked tools/install_agents_hook.py
```

The installer needs `features.hooks = true` in the user configuration.
It copies the authored script and lock into a directory whose name contains their combined digest.
It removes the old `PostToolUse` scope hook, preserves other hooks, and saves `hooks.json` before a change.
The installed command does not depend on this worktree.

Review and trust the exact definitions through Codex `/hooks`.
Installation alone does not establish host trust or prove hook execution.
Local hook definitions also need host trust.
Use a new session after installation if the active session does not reload hooks.

To reverse the global installation, restore its `hooks.json.before-agents-md-scope-*` backup.
Keep later unrelated hook changes when you restore the configuration.

## Evidence limits

The hook compares files at lifecycle events.
It is not a continuous file watcher.
The first baseline cannot prove earlier changes.
Reflog evidence describes Git transitions on this computer, not the identity of the person or tool that caused them.
A local Git actor can rewrite reflog messages or remote refs.
The hook trusts those local records.
A directory outside a readable Git repository receives an explicit skip result.

State stays under `$SLOPSENTRAL_SCOPE_HOME/state/agents-md-scope`, falling back to `$CODEX_HOME/state/agents-md-scope`, outside the repository.
Pi selects its own agent directory as `SLOPSENTRAL_SCOPE_HOME`.
State version 2 keeps local changes, changes from uncertain HEAD transitions, and queued instruction refreshes separate.
The `status` response retains `pending` and adds `provenance`, `instructionRefreshes`, and grouped `scopes`.
Version 1 pending reviews migrate as unattributed changes; migration never clears them.
Older hook versions reject version 2 state rather than silently dropping reviews.
Each repository and session has a separate state file and lock.
A missing baseline reports unproved earlier coverage.
Malformed state or instruction failures block `Stop` with an explicit failure code.

A recorded review proves that the agent acknowledged the current snapshot.
It does not prove that the resulting prose is complete or correct.
The agent must examine source evidence and do the normal prose assessment for instruction changes.
