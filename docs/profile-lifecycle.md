# Codex Profile Lifecycle

Use `slopsentral profile` to materialize one authored workflow profile as a
named Codex user profile without changing the base user config.
This first lifecycle slice owns only `${CODEX_HOME}/<profile>.config.toml`. It
sets the enabled state of every `slopsentral` plugin: selected profile plugins
are enabled and the other `slopsentral` plugins are disabled. Plugin
installation, standalone skill state, user instructions, and hook trust are not
mutated yet.

Install the CLI directly from GitHub. Node 20.11 or newer is required:

```bash
npm install --global github:amichne/slopsentral#main
```

Pin an immutable release tag or full commit SHA instead of `#main` when the
installation must be reproducible. Run `slopsentral doctor` to check the Node
runtime, packaged profile assets, resolved Codex home, backup location, and
optional Codex executable. The check is read-only, and a missing Codex
executable is advisory.

## Plan And Apply

`plan` and `status` are read-only:

```bash
slopsentral profile plan local-development-default
slopsentral profile status local-development-default
```

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
