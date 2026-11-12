---
type: Module
title: okf_common.py
description: Shared module (PyYAML) providing frontmatter parsing and code-aware link extraction, used by both the validator and the visualizer.
tags: [module, parser, links, shared, pyyaml]
timestamp: 2026-06-16
---

# okf_common.py

The single source of truth for parsing OKF, imported by both
[validate.py](/systems/validator.md) and [visualize.py](/systems/visualizer.md) so they behave
identically (see [shared parser module](/decisions/shared-parser-module.md)).

## What it exposes

- `parse_frontmatter(text)` — PyYAML-backed; BOM/CRLF tolerant; returns `(data, error)`.
- `strip_code(text)` — removes fenced ``` / `~~~` blocks and inline `` `code` `` spans.
- `extract_links(text)` — runs `strip_code` first, then collects targets from inline
  `[text](target)` links, reference definitions, autolinks, and HTML `href`. **Links inside
  code are ignored** — this is what fixes the old false-positive bug.
- helpers: `is_external`, `path_part`, `resolve_link`, `is_nonempty_string`.

Requires PyYAML. Underpins the [conformance rules](/reference/conformance-rules.md) and is
covered by the [test suite](/reference/testing.md).
