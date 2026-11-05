---
type: Integration
title: Slopsentral command lifecycle
description: Trace explicit host and plugin selection through native commands, managed Amp links, Pi transactions, and guarded self-management.
tags: [cli, installation, consumers, recovery]
verified:
  - by: openwiki/0.6.1
    at: 2026-11-05T15:45:23.454Z
sources:
  - id: openwiki-source-694f90ac01e419c575288a8d
    resource: repo://tools/slopsentral.py
  - id: openwiki-source-7b856c75d4b229196420362d
    resource: repo://tools/slopsentral.py.lock
generated: { by: "codex", at: "2026-11-05T15:45:23.454Z" }
---

# Slopsentral command lifecycle

The `slopsentral` command installs, updates, and removes selected plugins for selected harnesses.
The [Python owner](../../tools/slopsentral.py) uses locked dependencies and uv.
The [bootstrap](../../install.sh) installs the command itself, without selecting host plugins.

## Select the operation and harnesses

`slopsentral` and `slopsentral setup` open guided setup in a terminal.
The fzf selector offers **Install all plugins** and **Update all installed plugins**.
Users can filter the list and select several harnesses with Tab or Ctrl-A.
An action summary precedes host effects. Escape or Ctrl-C cancels with status 130.
The locked uv environment supplies fzf. Personal `FZF_*` options do not change the selector.
`NO_COLOR` disables color. Terminal input and stderr remain necessary when stdout is redirected.

Explicit operations use `--host`.
Codex, Copilot, and Amp accept `--plugin` selections or `--all`.
Pi uses its aggregate package and rejects plugin selections.
Amp and Pi accept a named stable version. Native Codex and Copilot channels reject `--version`.

```sh
slopsentral install --host codex --plugin software-engineering
slopsentral update --host amp --plugin developer-tooling
slopsentral install --host codex --all
slopsentral update --host codex --all
slopsentral remove --host pi
```

`install --all` reads the published catalog after the release archive passes digest examination.
`update --all` selects installed Slopsentral plugins from native inventories or managed Amp links.
An empty update starts no host changes. Pi keeps its existing aggregate setup path.
Bulk operations without `--host` open the harness selector.
Removal keeps explicit selections and rejects `--all`.

These operations use personal or system scope.
Project registrations remain outside the general command's scope.
The [Pi bootstrap](installation.md) owns project installation and rollback.
The [command guide](../../docs/cli-install.md) gives the installation and self-management procedures.

## Delegate host-owned state

Codex and Copilot operations use their native marketplace and plugin commands.
A recognized marketplace keeps its configured source.
An unknown source named `slopsentral` stops the operation.
Repeated installation preserves a selected plugin's enabled state.
Codex rejects an update for a disabled selected plugin because its reinstall operation can enable it.

The command stops after the first failed native operation.
Earlier successful operations remain in effect.
A completed command does not establish that a new host session loads or obeys the plugin.
Read [hook delivery](../architecture/hooks.md) before a claim of native consumption.

## Guard filesystem changes

Amp uses managed links to selected bundles from a stable archive.
The command examines archive origin, size, and digest, then rejects traversal, links, and special files in the archive.
It preserves a different existing plugin directory.
Before replacement or removal, it compares installed files with the cached release.
Removal deletes managed links and keeps cached bytes.

Pi delegates to the qualified setup and transaction owner.
It preserves unrelated settings and private recovery records.
The command does not recreate Pi's lifecycle in another state machine.

## Manage the command separately

The launcher records absolute paths to uv and an immutable Python script copy.
Self-update examines release assets before it creates another command copy.
Self-removal examines recorded digests before it deletes managed command files.
Edited bytes stop replacement or removal.
Self-removal keeps uv and installed host plugins.

Each completed operation prints one JSON object on stdout.
Native diagnostics use stderr. A failure returns a nonzero status.
Argument errors use status 2.
An interrupted update can leave a lock or incomplete receipt, which a later operation preserves as a conflict.
[Focused command tests](../../tools/python_checks/test_slopsentral.py) cover native planning, guarded files, release assets, and rejection paths.
