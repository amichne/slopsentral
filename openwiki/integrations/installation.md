---
type: integration
title: Install Pi and Amp consumers
description: Choose Pi's verified release installer or Amp's complete directory bundles, preserve installation scope, and recover without overwriting unrelated content.
tags: [installation, pi, amp, recovery]
verified:
  - by: openwiki/0.6.1
    at: 2026-10-26T15:55:34.144Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-a36608fe0211a909095a55f8
    resource: repo://docs/pi-install.md
  - id: openwiki-source-2a773b8dcd244b49fcf7a60f
    resource: repo://docs/pkl-projection.md
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-965e21463a3abc211c0d505e
    resource: repo://tools/install-pi.sh
  - id: openwiki-source-755a3cefcf633172d98cf969
    resource: repo://tools/setup-pi.mts
generated: { by: "amp", at: "2026-10-26T01:49:39.323Z" }
---

# Install Pi and Amp consumers

Choose the host and installation scope first. Installation makes content
available; it does not establish host discovery, project trust, or model
compliance. Neither path turns an installed cache into authored source.

## Pi: use the published installer

On macOS or Linux, install Pi and Node.js 22.19 or later, and have curl and
system tar available. From the project whose old registration needs migration:

```sh
bash -o pipefail -c 'curl -fsSL https://github.com/amichne/slopsentral/releases/latest/download/install-pi.sh | sh'
```

The launcher selects a stable release, verifies the installer asset size and
SHA-256 digest, then delegates to those exact bytes. Consumer setup needs no
checkout, npm installation, Python, uv, or Pkl. The native installer verifies
release and source identity plus successful main validation before configuration
changes.

Personal scope is the default: `~/.pi/agent` or `PI_CODING_AGENT_DIR`.
Use `--project` for project scope, or `--version X.Y.Z` for a published version.
The [Pi runbook](../../docs/pi-install.md) gives the curl-to-shell argument
forms. Restart Pi and verify `/skill:semantic-ratchet` afterward.

The package contains only the canonical `semantic-ratchet` skill. It adds no
extensions, hooks, commands, instruction policy, or model calls. A successful
`pi --version` probe establishes executability, not native feature compatibility.
Project trust remains Pi's decision.

## Pi updates and recovery preserve unrelated state

Rerun the installer to update. It migrates recognized Slopsentral registrations
in personal and current-project settings while preserving unrelated settings.
It stores private recoverable preimages. Repeating an unchanged installation
returns `CURRENT`; ambiguous legacy extensions or changed installed bytes stop
setup rather than being overwritten.

Rollback uses the same project directory and scope. Pass `--rollback`, adding
`--project` for project recovery. It still verifies the release, but needs neither
Pi nor tar and never executes project-cached recovery code. If settings changed
after installation, `CONFIG_CHANGED` preserves those edits for manual recovery.

## Amp: install a complete selected bundle

From a prepared checkout with the pinned Pkl runtime, generate a fresh package:

```sh
node tools/project-marketplaces.mjs --source . --harness amp --out /tmp/slopsentral-amp-new
```

Copy selected whole directories from its `.amp/plugins/` into the project's
`.amp/plugins/`, without replacing existing directories. Start with
`software-engineering`; add `kotlin-engineering` for Kotlin work. Reload plugins,
then check discovery with `amp plugins list` and
`amp skill info software-engineering:semantic-ratchet`.

Skills, scripts, references, instructions, and `capabilities.json` travel
together. Do not install only `index.js`. Amp supports skill registration and
turn-start instructions; hooks, agents, and MCP configuration remain references.
Workflow profiles are unsupported. See
[projection boundaries](../architecture/projection.md) for the mapping.

To update, stop sessions using the installation, move old bundles to a backup
outside discovery roots, and copy complete replacements into vacant destinations.
Do not merge directory contents: removed files must disappear. Reload and check
each bundle. Restore the backup if discovery fails. Copied directories are not
updated by `amp plugins update`.

The [Amp runbook](../../docs/pkl-projection.md#amp-native-plugins) also covers
user-local scope, prebuilt `harness/amp` payloads, revision recording, and native
checks. Provider branches move; [release archives](../operations/releases.md)
are versioned snapshots. For a separate instruction-only installation, use
[portable global instructions](global-instructions.md).
