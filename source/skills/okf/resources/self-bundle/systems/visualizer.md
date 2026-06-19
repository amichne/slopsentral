---
type: Module
title: visualize.py
description: Renders a bundle's explicit concept links as a self-contained, offline interactive graph.
tags: [visualizer, graph, html, offline]
timestamp: 2026-06-16
---

# visualize.py

Generates `viz.html` (interactive) and `graph.mmd` (aggregated Mermaid) from a bundle. It uses
the shared [okf_common.py](/systems/okf-common.md) parser, so the graph matches exactly what the
[validator](/systems/validator.md) checks — including ignoring links inside code.

```
python scripts/visualize.py <bundle> [--title "..."]
```

The graph is **fully self-contained and offline**: a vanilla-JS force-directed graph rendered on
a `<canvas>`, with no CDN or external scripts — see
[self-contained visualizer](/decisions/self-contained-viz.md). Reserved files (`index.md` /
`log.md`) are excluded so the graph shows the *semantic* links between
[concepts](/reference/concept-types.md). Invoked via [`/okf viz`](/systems/okf-command.md).
