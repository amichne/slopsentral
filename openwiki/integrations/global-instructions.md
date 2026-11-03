---
type: Integration
title: Portable instructions and pinned references
description: Install self-contained engineering principles with a digest-named local source snapshot, then examine agreement without implicit replacement.
tags: [instructions, portable, installation, snapshots]
verified:
  - by: openwiki/0.6.1
    at: 2026-11-03T18:14:45.754Z
sources:
  - id: openwiki-source-36ad8fcb548ba122b2048846
    resource: repo://docs/global-agents.md
  - id: openwiki-source-a21310cda5a734a20e146119
    resource: repo://tools/install_global_agents.py
generated: { by: "codex", at: "2026-11-03T17:57:45.987Z" }
---

# Portable instructions and pinned references

The [portable AGENTS.md](../../docs/examples/global/AGENTS.md) expresses engineering principles without a plugin dependency.
Its rules connect invariant design, explicit effects, faithful evidence, knowledge maintenance, and authorized delivery.
The [source map](../../docs/global-agents.md) links those principles to their authored origins.

## Capture one selected source snapshot

The [installer](../../tools/install_global_agents.py) reads the committed asset manifest and examines each referenced source digest.
The manifest includes transitive Markdown references and necessary companion files.
It preserves repository-relative paths inside the snapshot.
External URLs remain citations that need network access.

The destination must already exist as a real directory.
Installation needs uv and Python 3.12 or 3.13.
The explicit destination can represent a host instruction directory or a repository root.
The tool does not select the user's destination implicitly.

```sh
uv run --locked tools/install_global_agents.py manifest
uv run --locked tools/install_global_agents.py install --destination /absolute/instruction/directory
```

The installer places `AGENTS.md` beside `.slopsentral/<manifest-sha256>/`.
That snapshot contains the pinned source map and referenced assets.
The installed root file links to those local references.
A source checkout is unnecessary for later document reads.

## Publish without replacement

Source bytes enter a prepared representation only after digest examination.
The installer stages the snapshot, examines its written assets, and publishes the root instructions last.
Publication rejects an existing target instead of replacing it.
A different existing installation is preserved as a conflict.
An identical installation returns `UNCHANGED` without another write.

If publication fails, cleanup removes only the unchanged new snapshot that the operation owns.
Unproved cleanup ownership produces `RECOVERY_NEEDED` and preserves paths for inspection.
A process interruption can leave a partial snapshot without `AGENTS.md`.
The next installation rejects that partial state instead of guessing its ownership.

## Examine agreement and refresh deliberately

Use the same explicit destination for inspection:

```sh
uv run --locked tools/install_global_agents.py verify --destination /absolute/instruction/directory
```

The command rejects changed, missing, unexpected, or symlinked assets.
The installed snapshot includes the installer and its lock, so inspection can use that copy after the checkout disappears.
The [source map](../../docs/global-agents.md#refresh-and-recovery) gives the exact copied command.

After a deliberate source review, refresh the committed asset manifest with `manifest --write`.
New linked files must first enter Git's index.
The refresh changes expected source digests without changing installed snapshots.
A different installed snapshot needs its own deliberate installation choice.

SHA-256 establishes agreement with the selected manifest.
It does not authenticate an attacker-controlled script and manifest.
The procedure assumes a trusted destination parent and does not prove crash durability or resistance to a hostile concurrent writer.
[Installer tests](../../tools/python_checks/test_global_agents.py) exercise real file effects.
A successful installation does not prove that a fresh agent session loads or obeys the instructions.
