---
type: Reference
title: Frontmatter fields
description: The YAML header every OKF concept begins with; only `type` is required.
tags: [frontmatter, yaml, fields, spec]
timestamp: 2026-06-16
---

# Frontmatter fields

Every non-[reserved](/reference/reserved-files.md) concept begins with a YAML frontmatter block
delimited by `---`.

| Field | Required | Meaning |
|---|:---:|---|
| `type` | yes | A non-empty string — what kind of [concept](/reference/concept-types.md) this is. |
| `title` | no | Human-readable name (else derived from the filename). |
| `description` | no | One sentence; the quick-query summary. |
| `resource` | no | A URI for the underlying asset. |
| `tags` | no | A YAML list for cross-cutting filtering. |
| `timestamp` | no | ISO-8601 of the last meaningful change (a date is fine). |

Producers may add extra keys; consumers preserve them. The [validator](/systems/validator.md)
requires `type` to be a non-empty string, per the
[conformance rules](/reference/conformance-rules.md).
