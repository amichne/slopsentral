# OKF Knowledge Page Contract

Use this contract for generated or maintained Open Knowledge Format Markdown.
OKF is intentionally small: a bundle is a directory of Markdown files with YAML
frontmatter. Every non-reserved concept document must have parseable
frontmatter with a non-empty `type`.

Spec basis: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md

## Page Shape

Each concept document should start with:

1. A YAML frontmatter block delimited by `---`.
2. Standard OKF fields: `type`, and preferably `title`, `description`,
   `resource`, `tags`, and `timestamp`.
3. Producer-defined code evidence fields such as `code_sources`.
4. A Markdown body with headings, lists, tables, fenced examples, links, and
   citations.

Example:

```md
---
type: Kotlin Module
title: Analysis API
description: Shared contracts and serializable models for compiler-backed analysis.
resource: file://analysis-api
tags: [kotlin, gradle, api]
timestamp: 2026-06-17T00:00:00Z
code_sources:
  - path: analysis-api/src/main/kotlin/example/AnalysisBackend.kt
    lines: "22-140"
    symbols: [AnalysisBackend]
---

# Public Contract

The module defines the stable analysis boundary.

# Citations

[1] [AnalysisBackend source](../analysis-api/src/main/kotlin/example/AnalysisBackend.kt)
```

## OKF Fields

- `type`: required short concept kind. Examples for Kotlin/Gradle include
  `Kotlin Module`, `Gradle Task`, `API Contract`, `Runtime Flow`, `Playbook`,
  and `Glossary Term`.
- `title`: display name. Consumers may derive it from the filename if omitted.
- `description`: one-sentence summary.
- `resource`: URI for the underlying asset when one exists. `file://` URIs are
  acceptable for repository-local resources.
- `tags`: short strings for filtering and grouping.
- `timestamp`: ISO 8601 time for the last meaningful concept update.

## Producer Extensions

`code_sources` is the extension used by this plugin for impact detection:

```yaml
code_sources:
  - path: src/main/kotlin/example/App.kt
    lines: "10-42"
    symbols: [App, run]
```

Keep extension fields simple and preserve unknown fields when round-tripping.
Do not require consumers to understand `code_sources` to read the OKF bundle.

## Evidence Rules

- Prefer exact source paths and symbols over vague subsystem names.
- Link pages to generated API specs, schemas, command catalogs, or docs
  contracts when those are the public boundary.
- Do not cite build outputs unless the repository treats them as a checked or
  reproducible source of truth.
- If a claim cannot be traced to source, either remove it or label it as an
  explicit assumption in prose.

## Impact Rules

- A changed file impacts every concept that cites it in `code_sources[].path`.
- A changed generator, schema, command catalog, or index contract may impact
  every page whose source set depends on that generated surface.
- A renamed source path must update frontmatter before the page is considered
  current.
- Missing optional OKF fields do not make a concept invalid. Missing or empty
  `type` does.

## Validation

Run:

```sh
python3 source/skills/code-knowledge-base/scripts/code_kb.py check --repo . --docs docs
```

Use `--strict` when missing frontmatter, empty `type`, invalid logs, or invalid
`code_sources` should fail the check.
