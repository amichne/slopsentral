---
type: Overview
title: okf-knowledge
description: A portable Claude Code skill (/okf) that creates, reads, maintains, and visualizes Open Knowledge Format bundles.
tags: [okf, skill, overview, dogfood]
timestamp: 2026-06-16
---

# okf-knowledge

**okf-knowledge** is independent, open tooling for Google Cloud's
[Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)
(OKF, v0.1). It gives an AI agent — and a human — everything needed to turn scattered knowledge
into a navigable graph of small Markdown "concept" files.

It ships three things:

- **[The `/okf` command](/systems/okf-command.md)** — a command-driven Claude Code skill
  (`init` / `update` / `query` / `validate` / `viz` / `add`).
- **[A validator](/systems/validator.md)** — `validate.py`, which enforces the OKF
  [conformance rules](/reference/conformance-rules.md).
- **[A visualizer](/systems/visualizer.md)** — `visualize.py`, which renders a bundle's link
  graph as interactive HTML.

This bundle is **dogfooding**: okf-knowledge's own knowledge, expressed in OKF. See the
[design decisions](/decisions/index.md) for why it is built the way it is.
