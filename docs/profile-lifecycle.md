# Codex Profile Lifecycle

Use `slopsentral profile` to materialize one authored workflow profile as a
named Codex user profile without changing the base user config.
The lifecycle ensures the declared marketplace, installs selected plugins, and
owns `${CODEX_HOME}/<profile>.config.toml`. The overlay enables selected
`slopsentral` plugins and disables unselected ones under the default
`DISABLE_UNSELECTED` reconciliation policy. Foreign marketplaces and plugins
are preserved.

Install the CLI directly from GitHub. Node 20.11 or newer is required:

```bash
npm install --global github:amichne/slopsentral#main
```

Pin an immutable release tag or full commit SHA instead of `#main` when the
installation must be reproducible. Run `slopsentral doctor` to check the Node
runtime, packaged profile assets, resolved Codex home, backup location, and
optional Codex executable. The check is read-only, and a missing Codex
executable is advisory for `doctor`; profile operations require Codex CLI
0.134.0 or newer.

## Plan And Apply

`plan` and `status` are read-only:

```bash
slopsentral profile plan local-development-default
slopsentral profile status local-development-default
```

They inspect the Codex version, configured marketplaces, installed plugins, and
the target overlay. `plan` returns an ordered operation list such as
`MARKETPLACE_ADD_PLANNED`, `PLUGIN_INSTALL_PLANNED`, and
`FILE_CREATE_PLANNED`. `status` returns `PROFILE_CHANGES_REQUIRED` until those
operations have been applied.

Plugin inventory reads are restricted to installed Slopsentral plugins. Reports
include `inventoryObservation` with the marketplace and observed count. A failed
inventory returns a closed `PLUGIN_INVENTORY_FAILED` outcome identifying the
stage and reason, without recording command output or proceeding with writes.

Apply a profile:

```bash
slopsentral profile apply local-development-default
```

The command refuses to replace a pre-existing file that does not carry the
matching Slopsentral ownership marker. Adopt such a file only when replacement
is intentional; its original bytes and mode are backed up before the write:

```bash
slopsentral profile apply local-development-default \
  --replace-existing
```

An unchanged managed profile is a no-op and does not create a transaction.
Apply checks for an unmanaged target before adding a marketplace or plugin, so
a profile-file conflict cannot leave those external changes half-applied.

## Hook Review

Profiles no longer duplicate a list of plugin-owned hooks. The lifecycle derives
that list from the selected plugin manifests and returns `HOOK_REVIEW_REQUIRED`
with the configured `OFF`, `ADVISORY`, or `ENFORCING` policy. It never writes
Codex's runtime-owned hook trust state. Review and trust non-managed hooks in
Codex with `/hooks`. When Codex appends `[hooks.state]` to a managed profile
overlay, later lifecycle operations preserve that section byte-for-byte.

`required-skill-read` is packaged only by the opt-in `skill-read-policy` plugin.
No authored default profile selects that plugin. The default engineering and
Kotlin plugins install concise instruction files once instead of launching
concept-injection processes at session lifecycle events.

## Profile Contract

Workflow profile schema version 2 owns these policies:

- `plugins` names the enabled Slopsentral plugin set.
- `reconciliation.unselected` is `PRESERVE`, `DISABLE_UNSELECTED`, or
  `REMOVE_UNSELECTED`; authored defaults use `DISABLE_UNSELECTED` and never
  uninstall plugins.
- `hookPolicy.mode` is `OFF`, `ADVISORY`, or `ENFORCING`.
- `standaloneSkills` uses typed `PRESENT`, `ABSENT`, and `PRESERVE` states.
  `PRESENT` installs a missing marketplace skill at the stable
  `${CODEX_HOME}/skills/<name>` path and enables it in the overlay. `ABSENT`
  disables that path without deleting it, and `PRESERVE` omits the override.
  A different pre-existing skill directory is a conflict and is never replaced.

## Automatic Repository Activation

`kotlin-repo-default` declares its repository anchor:

```json
"activation": {
  "type": "REPOSITORY_ROOT_FILE",
  "path": "settings.gradle.kts"
}
```

The rule selects Engineering Baseline, Kotlin Engineering, Developer Tools,
Effective Delivery, and Code Knowledge Base. The profile remains the owner of
that plugin list; hooks do not duplicate it. Automatic rules select plugins;
profiles with standalone skill overrides use the explicit named-profile commands.

Within a Git repository, detection uses the worktree root, including when called
from a subdirectory. A nested `build-logic/settings.gradle.kts` alone does not
match. Outside Git, `--repo` names the root directly. The detector checks a
regular file and never reads or executes Gradle source. Symlinks and ambiguous
matches produce a failure.

Inspect or apply the current repository:

```bash
slopsentral context plan --repo /path/to/repository
slopsentral context status --repo /path/to/repository
slopsentral context apply --repo /path/to/repository
```

`plan` and `status` inspect repository configuration without invoking Codex or
installing anything. Their evidence is configuration state, not proof that a
running session loaded the tools. `apply` provisions the selected plugins through
the existing profile lifecycle and adds enabled plugin entries to a managed block
in `<repo>/.codex/config.toml`. Automatic activation preserves unselected plugins,
models, reasoning settings, and other user configuration. It does not apply the
named profile's `DISABLE_UNSELECTED` policy to the project file.

Each changed project file gets a versioned preimage using the same transaction
store as named profiles. Use `slopsentral profile rollback <manifestPath>` with
the returned project transaction to restore it. Named-overlay and project-file
transactions are separate, and plugin installations remain installed after
rollback. Removing the anchor removes only the intact managed block on the next
activation. A manually edited block, explicitly disabled selected plugin, invalid
TOML, or symlinked configuration is a conflict; the command does not overwrite it.
Concurrent activation reports `ACTIVATION_IN_PROGRESS`. If a process was killed,
confirm it has ended before removing its `.codex/.slopsentral-context.lock` file.

For activation before a terminal session starts:

```bash
slopsentral context launch --repo /path/to/repository
slopsentral context launch --repo /path/to/repository -- exec "Inspect the build"
```

The command forwards Codex arguments and exit status. Use `--repo` for the working
directory; forwarded `--cd` and remote-server options are rejected because they
would change the context that was proven. In nonmatching repositories it launches
Codex with the existing configuration.

For desktop sessions, install the Slopsentral CLI above, update the Slopsentral
marketplace, and install or update `developer-tools@slopsentral`. Review its
`repository-profile` hook through Codex's normal `/hooks` interface. The adapter
runs at startup and resume and delegates to `slopsentral context hook`. Codex
loads configuration before `SessionStart`, so changes made at that point are
available in the next session. Use `context apply` before opening the first
desktop session when those tools must be available immediately. Normal Codex
project trust still applies. This code never writes hook trust or bypasses it.
See the official [profile configuration](https://learn.chatgpt.com/docs/config-file/config-advanced)
and [SessionStart contract](https://learn.chatgpt.com/docs/hooks).

### GPT-6 Astra Context Budget

This integration follows the repository's Astra execution guidance and the
official [GPT-6 Astra prompting guidance](https://developers.openai.com/api/docs/guides/latest-model).
Repository detection is deterministic. Successful unchanged hooks emit no
context and skip plugin commands; hooks do not run at compaction or on every
tool call. Changed or failed activation emits one bounded status message.
Skills remain available for task-specific loading. A root marker does not ask
the agent to read all Kotlin skills, regenerate knowledge, run Gradle, or delegate
a review. Explicit model and reasoning settings remain under the user's control.
The tests prove these configuration and output contracts; they are not a live
Astra performance benchmark.

## Backup Location

The default transaction root is
`${CODEX_HOME:-$HOME/.codex}/backups/slopsentral`. Override it for one command
with `--backup-root`, or set `SLOPSENTRAL_BACKUP_ROOT`. The command-line option
takes precedence.

Transactions use unique, never-reused directories:

```text
<backup-root>/<profile>/<transaction-id>/
  manifest.json
  files/000-before
```

`files/000-before` exists when the target existed. A creation instead records a
typed `FILE_ABSENT` preimage. The manifest records SHA-256, byte length, and Unix
mode, and conforms to
`source/schemas/profiles/profile-transaction.schema.json`.
The manifest advances from prepared to committed; the preimage is created
exclusively and is never overwritten.

## Transaction States

An apply has two persisted states:

1. `PREPARED_TRANSACTION`: the target's preimage has been copied and its digest
   verified. The atomic target write may not have happened yet.
2. `COMMITTED_TRANSACTION`: the target write completed and the manifest records
   its completion time.

The transaction directory and prepared manifest are written before the target.
The target is then replaced atomically. If interruption leaves a prepared
manifest after the target write, `rollback` recognizes the after-image,
finalizes that transaction, and reverses it. If the target still matches its
before-image, rollback reports that it is already restored.

## Roll Back

Use the exact `manifestPath` returned by `apply`:

```bash
slopsentral profile rollback \
  /absolute/backup/root/local-development-default/<transaction-id>/manifest.json \
  --backup-root /absolute/backup/root
```

Rollback validates the transaction schema and path identity, verifies the
stored preimage, and requires the live target to match the recorded after-image.
If the target changed later, it returns `PROFILE_CONFLICT` and writes nothing.

Rollback is itself a new versioned transaction. It captures the file it is
about to replace or remove, so passing that rollback transaction's
`manifestPath` to `rollback` reapplies the prior state.

Transactions cover the generated TOML overlay. Marketplace and plugin changes
are delegated to Codex, and newly installed standalone skills are preserved;
these effects are not reversed by profile rollback. The default reconciliation
policy does not uninstall plugins or delete skills. It disables unselected
Slopsentral plugins only in the named overlay.

## Paths, JSON, And Exit Codes

Pass `--codex-home PATH` or `--backup-root PATH` to any profile operation. The
environment variables `CODEX_HOME` and `SLOPSENTRAL_BACKUP_ROOT` remain the
defaults when those flags are absent.

All operational commands emit JSON. The exit status is part of the interface:

- `0`: success, including a ready `doctor` report
- `1`: runtime or I/O failure, including a failed required `doctor` check
- `2`: invalid command, request, profile, or contract
- `3`: a safe-write or rollback conflict

Help and version output are human-readable. Removing the package does not
delete profiles or transaction history:

```bash
npm uninstall --global slopsentral
```

Repository maintainers can continue using the direct lifecycle entrypoint with
its existing option form, for example:

```bash
node tools/profile-lifecycle.mjs plan --profile local-development-default
```

## Verify The Contracts

```bash
npm run validate:profile-contracts
node --test tools/tests/portable-cli.test.mjs
node --test tools/tests/profile-lifecycle.test.mjs
node tools/validate-source-graph.mjs
```

The workflow profile schema is
`source/schemas/profiles/workflow-profile.schema.json`. The source-graph gate
validates every authored profile against it before checking referenced plugin
and hook ownership.
