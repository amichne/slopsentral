# Maintain scoped instructions

The `agents-md-scope` hook maps Git changes to instruction scopes.
The agent examines those scopes and records either an instruction change or a source-backed no-change decision.
A receipt records that review. It does not prove that the instructions are correct.

Shared rules belong in their owning ancestor.
Create a child `AGENTS.md` only when commands, source ownership, or local behavior support a distinct rule.
Keep generated provider instructions with their authored owners.

## Events and review

The first `UserPromptSubmit` creates a baseline without an obligation for preexisting edits.
Later prompts and `Stop` compare actual changes with that snapshot.
The comparison includes committed edits, untracked files, renames, deletions, failed-tool changes, and external edits between events.

Changed instructions also create a review of descendant scopes.
The hook reads repository and ancestor `AGENTS.md` and `AGENTS.override.md` files.
It includes the global instruction scope under `CODEX_HOME` and rejects instruction symlinks.

A proven remote refresh exempts source changes from a new task obligation.
The hook uses an unbroken HEAD reflog chain to a remote-backed commit for that decision.
Local commits in the chain keep their review obligation, including after a push.
Missing or rewritten history keeps the conservative source review.
Remote refreshes preserve pending reviews and local edits.
Changed instruction files still need their scope review.

`Stop` requests continuation while a review remains pending.
Use its exact `status` command to examine affected paths.
Read each instruction chain before its exact `review` command.
Replace the sample note with the source-backed decision.
Managed Pi commands keep their private interpreter and instruction scope through the status-to-review sequence.
They need no system Python or uv. Other installations keep their uv launcher.
Later source edits create another obligation.

## Install on this computer

Software Engineering composes the hook.
The checkout also declares it in `.codex/hooks.json`.
Both use shared repository-and-session state, so duplicate events do not duplicate obligations.

For an authorized global installation from this checkout, use:

```sh
uv run --locked tools/install_agents_hook.py
```

The installer needs `features.hooks = true`.
It copies the script and lock into a directory with their combined digest.
It preserves other hooks and saves the prior `hooks.json`.
It also removes the retired `PostToolUse` scope hook.
The installed command does not depend on this checkout.

Review and trust the exact definitions through Codex `/hooks`.
If the current session does not reload hooks, start a new session.
Installation alone proves neither trust nor event delivery.
To reverse installation, restore the recorded `hooks.json.before-agents-md-scope-*` backup while preserving later unrelated changes.

## Evidence limits

The hook compares files at lifecycle events. It does not watch files continuously.
The first baseline cannot prove earlier work.
A local Git actor can change reflog messages and remote refs that the hook trusts.

State resides under `$CODEX_HOME/state/agents-md-scope` with a file and lock for each repository and session.
Malformed state and instruction failures block `Stop` with explicit failure codes.
An unreadable Git repository receives a skip result.
Instruction payloads stay outside diagnostic logs.

[Hook implementation](../source/hooks/agents-md-scope.py), [installer](../tools/install_agents_hook.py), and
[focused tests](../tools/python_checks/test_agents_scope_hook.py) own this behavior.
Use the [documentation workflow](../openwiki/workflows/documentation.md) for source-backed instruction prose.
