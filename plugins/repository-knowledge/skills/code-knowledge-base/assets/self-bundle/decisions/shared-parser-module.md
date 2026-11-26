---
type: Decision
title: Shared parser module (okf_common)
description: validate.py and visualize.py share one parsing/link-extraction module instead of each having its own.
tags: [decision, dry, parser, links]
timestamp: 2026-06-16
---

# Decision: a shared parser module

**Context.** The [validator](/systems/validator.md) and [visualizer](/systems/visualizer.md)
each had their own frontmatter/link parsing. They diverged — the visualizer's regex parser was
weaker, and the two could disagree about what counts as a link.

**Decision.** Extract one shared module, [okf_common.py](/systems/okf-common.md), and import it
from both.

**Why.** One authoritative implementation removes a maintenance hazard and guarantees the graph
the visualizer draws matches the links the validator checks. It also concentrates the
code-aware link extraction (ignoring code blocks) in one place. Surfaced by the
[adversarial audit](/decisions/adversarial-audit-process.md).
