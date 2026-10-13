---
type: System
title: The /okf command
description: The command-driven Claude Code skill that builds, syncs, reads, validates, and visualizes OKF bundles.
tags: [okf, command, skill, claude-code]
timestamp: 2026-06-16
---

# The `/okf` command

okf-knowledge is delivered as a **command-driven** skill (see
[command-driven over hooks](/decisions/command-driven-over-hooks.md)): the user runs a
subcommand and the agent follows the matching flow.

| Command | What it does |
|---|---|
| `/okf` | Smart default: sync `okf/` if it exists, else propose `init`. |
| `/okf init [path]` | Build a new bundle from a project's code + docs. |
| `/okf update [path]` | Sync the bundle with what changed; fix links, append `log.md`, validate. |
| `/okf query "<q>"` | Answer by navigating the bundle index-first (no full-file dumps). |
| `/okf validate [path]` | Run conformance + lints via the [validator](/systems/validator.md). |
| `/okf viz [path]` | (Re)generate the graph via the [visualizer](/systems/visualizer.md). |
| `/okf add "<thing>"` | Add one concept and wire its links. |

The skill is named `okf`, so `/okf` is the native trigger on install — see
[skill named okf for a native trigger](/decisions/name-okf-native-trigger.md). Every flow ends
by running the validator and fixing errors. Concepts follow the
[frontmatter rules](/reference/frontmatter-fields.md) and use absolute links.
