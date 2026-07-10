# Pkl Baseline and Kotlin Skill Rename Design

## Goal

Make `pkl-engineering` part of the default engineering baseline, make that skill
installable by itself with one repository command, and remove the local
`kotlin-standards` collision by renaming the primitive to
`kotlin-design-practices`.

## Source-graph design

`engineering-baseline` will compose the existing standalone `pkl-engineering`
primitive by reference. The marketplace continues to expose the same primitive
independently; the plugin does not own or copy its payload.

The Kotlin skill rename is structural and complete. Its directory, frontmatter,
plugin reference, hook dependency, marketplace entry and dependency, routing
evaluation paths and names, and sibling-skill prose references all change to
`kotlin-design-practices`. There is no compatibility alias, because retaining
the old installed name would preserve the collision.

## Standalone installation command

`source/tools/install-skill pkl-engineering` installs a marketplace-listed skill
as a real directory under `${CODEX_HOME:-$HOME/.codex}/skills`. The command is
generic so other standalone marketplace skills can reuse it without adding a
second installer.

The command validates the requested name, confirms the marketplace entry and
source `SKILL.md`, and stages a complete copy before moving it into place. An
existing identical installation is an idempotent success. A different existing
installation is rejected unless `--force` is explicit. `--codex-home <path>`
provides a deterministic test and automation seam without mutating the real
user home.

Stdout is a compact TOON-style result containing the skill, destination, and
status. Usage errors exit 2; operational failures exit 1; success and no-op exit
0. The command never prompts.

## Proof

The installer receives a focused shell-driven Node test covering fresh install,
idempotent repeat, overwrite refusal, forced replacement, unknown skill, and
unknown option behavior. Source graph and plugin composition validation prove
the manifest and rename changes. Portable validation and fresh provider
materialization prove the authored marketplace can still hydrate for every
provider.
