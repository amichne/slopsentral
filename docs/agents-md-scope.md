# Maintain scoped instructions

The `agents-md-scope` hook requests instruction maintenance after Git changes.
It names the affected scopes and refreshes changed instruction text in the agent context.
The agent must examine the source before it changes instructions.

Shared rules belong in the ancestor that owns them.
The agent creates a child `AGENTS.md` only when source evidence supports a local difference.
Commands, source ownership, generated files, and local rules can justify that difference.
The hook does not create placeholder files or copy parent rules into children.

## Events and review

`UserPromptSubmit` establishes the first baseline without a review obligation for preexisting edits.
Later prompts and `PostToolUse` compare actual Git changes against the previous snapshot.
Changes include untracked files, renames, deletions, committed edits, and edits from external tools between events.
A failed tool can still change files, so its exit status does not suppress the comparison.

Changed instructions trigger a review of their descendants.
The hook reads `AGENTS.md` and `AGENTS.override.md` in the repository and its ancestors.
It also reads the global instructions under `CODEX_HOME`.
The hook rejects instruction symlinks and keeps source payloads outside diagnostic logs.
Generated Slopsentral projections under `.agents/plugins` and `.github/plugin` stay with their authored owners.

`Stop` requests a continuation until the agent records its scope review.
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
It preserves unrelated global hooks and saves the previous `hooks.json` before a change.
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
A directory outside a readable Git repository receives an explicit skip result.

State stays under `$CODEX_HOME/state/agents-md-scope`, outside the repository.
Each repository and session has a separate state file and lock.
A missing baseline reports unproved earlier coverage.
Malformed state or instruction failures block `Stop` with an explicit failure code.

A recorded review proves that the agent acknowledged the current snapshot.
It does not prove that the resulting prose is complete or correct.
The agent must examine source evidence and do the normal prose assessment for instruction changes.
