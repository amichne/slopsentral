# Codex Profile Lifecycle

Normal plugin use relies on the host marketplace and passive plugin
instructions. There is no Slopsentral global binary, launch wrapper, or automatic
repository-profile hook.

For explicit maintenance, run `node tools/profile-lifecycle.mjs` from this
checkout after `npm ci` (Node 20.11 or newer). The tool materializes an authored
workflow profile as a named Codex user profile without changing the base user
config. It also restores saved transactions from the retired CLI.

The lifecycle ensures the declared marketplace, installs selected plugins, and
owns `${CODEX_HOME}/<profile>.config.toml`. The overlay enables selected
`slopsentral` plugins and disables unselected ones under the default
`DISABLE_UNSELECTED` reconciliation policy. Foreign marketplaces and plugins
are preserved. Profile operations require Codex CLI 0.134.0 or newer.

## Plan And Apply

`plan` and `status` are read-only:

```bash
node tools/profile-lifecycle.mjs plan --profile local-development-default
node tools/profile-lifecycle.mjs status --profile local-development-default
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
node tools/profile-lifecycle.mjs apply --profile local-development-default
```

The command refuses to replace a pre-existing file that does not carry the
matching Slopsentral ownership marker. Adopt such a file only when replacement
is intentional; its original bytes and mode are backed up before the write:

```bash
node tools/profile-lifecycle.mjs apply --profile local-development-default \
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

## Retired Repository Activation

The repository-root `activation` field, `context` commands, and
`repository-profile` startup hook have been removed. Profiles with the retired
field fail schema validation. Select plugins through the host or run an explicit
profile operation above; a `settings.gradle.kts` marker does not alter configuration.

Existing repository `.codex/config.toml` blocks and named overlays are preserved.
The transaction schema still accepts saved `APPLY_REPOSITORY_PROFILE` records so
rollback can restore their recorded preimages. Use the exact saved manifest and
backup root as described below. Refresh the plugin after publication to retire
its installed startup hook; editing this checkout does not update installed caches.

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
node tools/profile-lifecycle.mjs rollback \
  --transaction /absolute/backup/root/local-development-default/<transaction-id>/manifest.json \
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

- `0`: success
- `1`: runtime or I/O failure
- `2`: invalid command, request, profile, or contract
- `3`: a safe-write or rollback conflict

Removing a previous global package does not delete profiles or transaction
history. See [CLI retirement](../source/MIGRATION.md#retiring-the-global-cli).

## Verify The Contracts

```bash
npm run validate:profile-contracts
node --test tools/tests/profile-lifecycle.test.mjs
node tools/validate-source-graph.mjs
```

The workflow profile schema is
`source/schemas/profiles/workflow-profile.schema.json`. The source-graph gate
validates every authored profile against it before checking referenced plugin
and hook ownership.
