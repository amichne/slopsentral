---
type: integration
title: Portable global instructions
description: Install and verify a manifest-pinned instruction snapshot without overwriting an existing destination or confusing byte integrity with agent compliance.
tags: [instructions, installation, integrity, recovery]
sources:
  - id: openwiki-source-36ad8fcb548ba122b2048846
    resource: repo://docs/global-agents.md
  - id: openwiki-source-a21310cda5a734a20e146119
    resource: repo://tools/install_global_agents.py
generated: { by: "amp", at: "2026-10-26T01:58:25.745Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-10-26T01:58:25.745Z
---

# Portable global instructions

Use the portable installer when you need a self-contained `AGENTS.md` and its
local reference material. This is separate from
[installing provider plugins](installation.md): an instruction snapshot does
not install or load a plugin.

## What the snapshot contains

`docs/examples/global/AGENTS.md` expresses portable engineering principles.
`tools/global_agents.lock.json` pins the source assets and their SHA-256 hashes.
The installer follows local Markdown links and includes companion assets from
linked skills. It preserves repository-relative paths under
`.slopsentral/<manifest-sha256>/`, so local references survive without the
checkout. External URLs remain network citations.

The installed root file retains the principles and links to this local source
map. A hash establishes agreement with the selected manifest; it does not
authenticate an attacker-controlled script and manifest.

## Install into an explicit destination

The destination must already be a real directory. The installer requires uv
and Python 3.12 or 3.13. From the checkout root:

```sh
uv run --locked tools/install_global_agents.py manifest
uv run --locked tools/install_global_agents.py install --destination "$HOME/.codex"
uv run --locked tools/install_global_agents.py verify --destination "$HOME/.codex"
```

Select the repository root instead for a repository-scoped installation.
The default Codex global path is `~/.codex/AGENTS.md`; a different `CODEX_HOME`
changes that location. Check the target host's discovery rules before choosing
a destination. A home-directory `~/AGENTS.md` is not Codex's documented global
location.

## Publication and recovery

The installer captures and verifies source bytes before writing. It stages and
checks the snapshot, then publishes `AGENTS.md` last without replacing a file.
A different existing root file or snapshot is a conflict. An identical complete
installation returns `UNCHANGED`. Verification examines the selected snapshot
without repairing it and rejects changed, missing, unexpected, or symlinked
assets.

A failed publication removes only a new snapshot whose unchanged ownership
the installer can establish. If cleanup cannot prove ownership, it returns
`RECOVERY_NEEDED` and leaves the paths for inspection. Interruption can leave
a partial snapshot; a later install rejects it rather than silently completing
or overwriting it. The destination parent must be trusted. These operations do
not establish crash durability or resistance to a hostile concurrent writer.

## Refresh source without changing installed consumers

After changing a bundled source, review the portable guidance and run:

```sh
uv run --locked tools/install_global_agents.py manifest --write
uv run --locked tools/install_global_agents.py manifest
```

New linked files must be in the Git index before manifest refresh because the
inventory uses tracked files. Installation never refreshes expected digests.
Existing snapshots remain pinned; replacing one is a separate deliberate
operation. See the [source map and recovery runbook](../../docs/global-agents.md)
for copied-installer commands and digest binding.

The [authoring workflow](../workflows/authoring.md) checks source consistency.
A verified installation proves bytes and paths, not that a fresh agent session
loads or follows the instructions. Keep that distinction in
[documentation evidence](../workflows/documentation.md).
