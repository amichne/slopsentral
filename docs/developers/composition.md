# Plugins and profiles

Use plugin manifests to select capabilities without another copy of their implementation.
Use profiles for repeatable Codex selections.

## Marketplace and plugins

[source/adaptable.marketplace.json](../../source/adaptable.marketplace.json) owns the provider-neutral marketplace and primitive references.
Each `source/plugins/<name>/plugin.json` selects those references for one installable plugin.
References name a type, canonical path, source, and identity.

For example, [Software Engineering](../../source/plugins/software-engineering/plugin.json) selects `skills/semantic-ratchet` and the `software-engineering-context` hook.
The hook depends on the shared instruction files.
The resolver carries those dependencies into the package.
The plugin folder does not own copies of their payloads.

The [catalog](../../source/CATALOG.md) lists current selections.
Regenerate it after composition changes:

```sh
node tools/catalog.mjs --write
```

## Profiles

`source/profiles/` declares marketplace sources, selected plugins, hook policy, and reconciliation behavior.
The [Kotlin repository profile](../../source/profiles/kotlin-repo-default.json) selects Software Engineering and Kotlin Engineering.
It does not select Repository Knowledge.

A profile describes an explicit configuration operation.
Its selection does not tell an agent to run every skill.
The [profile lifecycle](../profile-lifecycle.md) owns planning, application, receipts, and recovery.
Amp does not support workflow profiles.

## Admission and projection

The [graph validator](../../tools/validate-source-graph.mjs) rejects missing paths, conflicting identities, cycles, and duplicate hook selection.
The [Pkl models](../../tools/projection/Schema.pkl) translate admitted source into finite provider representations.
Projection captures bytes and modes, then seals digests before publication.
Its publisher rejects an existing destination.

After a composition edit, run:

```sh
node tools/validate-source-graph.mjs
node tools/project-marketplaces.mjs --source . --harness codex --out /tmp/slopsentral-codex
node tools/project-marketplaces.mjs --source . --harness github-copilot --out /tmp/slopsentral-github-copilot
node tools/project-marketplaces.mjs --source . --harness amp --out /tmp/slopsentral-amp
git diff --check
```

Set `PKL_BIN` to Pkl 0.32.0 and use fresh destinations.
The [projection runbook](../pkl-projection.md) includes runtime setup and Pi packaging.
These gates establish composition and package content.
Native discovery and model behavior need separate host evidence.
