---
type: Reference
title: Concept types
description: The type field is a free-form string; consumers must tolerate unknown values.
tags: [type, taxonomy, reference]
timestamp: 2026-06-16
---

# Concept types

`type` (the only required [frontmatter field](/reference/frontmatter-fields.md)) is a free-form
string, **not registered centrally**. Pick descriptive values; consumers must tolerate unknown
ones. Common examples:

| Domain | Example `type` values |
|---|---|
| Data | `BigQuery Table`, `Dataset`, `MongoDB Collection`, `Metric` |
| Code | `Service`, `Module`, `API Endpoint`, `Library`, `Config` |
| Ops | `Runbook`, `Playbook`, `Incident`, `SLA` |
| Context | `Decision`, `Policy`, `Reference`, `Overview` |

This bundle uses `Overview`, `System`, `Module`, `Reference`, and `Decision`.
