---
type: Decision
title: Skill named okf for a native trigger
description: The skill is named okf (folder and frontmatter) so /okf works on install with no config.
tags: [decision, naming, trigger, install]
timestamp: 2026-06-16
---

# Decision: skill named `okf` for a native trigger

**Context.** Claude Code maps a slash command to a skill's `name`. If the skill were named
`okf-knowledge`, users would get `/okf-knowledge`, and the short `/okf` would require each user
to add a personal `CLAUDE.md` alias — config that does not ship in the repo.

**Decision.** Name the skill **`okf`** (both the folder and the `name:` frontmatter). The GitHub
repo stays `okf-knowledge` (project identity), but the command is `okf`.

**Why.** So **every user gets `/okf` immediately on install**, zero config — exactly how
`/graphify` works. Repo name and command name are independent.

See [the /okf command](/systems/okf-command.md).
