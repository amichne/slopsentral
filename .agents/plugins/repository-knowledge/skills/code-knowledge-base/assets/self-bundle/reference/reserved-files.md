---
type: Reference
title: Reserved files
description: index.md (navigation) and log.md (history) are reserved at every level and carry no type.
tags: [reserved, index, log, navigation]
timestamp: 2026-06-16
---

# Reserved files

Two filenames are reserved at every directory level and are **not**
[concepts](/reference/concept-types.md):

- **`index.md`** — the navigation map (progressive disclosure), the agent's entry point. Only
  the **bundle-root** `index.md` may carry [frontmatter](/reference/frontmatter-fields.md), and
  only to declare `okf_version: "0.1"`.
- **`log.md`** — chronological history, newest first, with bold convention words
  (`Initialization`, `Creation`, `Update`, `Removal`, `Fix`, `Deprecation`). Historical links
  may dangle and are exempt from the link check.

Neither takes a `type`. Enforced by rule 3 of the
[conformance rules](/reference/conformance-rules.md).
