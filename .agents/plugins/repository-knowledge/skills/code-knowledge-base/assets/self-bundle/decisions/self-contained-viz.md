---
type: Decision
title: Self-contained visualizer (no CDN)
description: viz.html embeds a vanilla-canvas graph instead of loading a library from a CDN.
tags: [decision, visualizer, offline, no-cdn]
timestamp: 2026-06-16
---

# Decision: a self-contained visualizer

**Context.** The first [visualizer](/systems/visualizer.md) loaded vis-network from a CDN. That
undercut OKF's "no runtime, just text" promise and broke offline use.

**Decision.** Replace the CDN dependency with a compact, dependency-free force-directed graph
rendered on a `<canvas>` in vanilla JavaScript, inlined into `viz.html`.

**Why.** The generated artifact is now fully offline and self-contained — consistent with the
format's portability values, and the tooling makes no network calls.
