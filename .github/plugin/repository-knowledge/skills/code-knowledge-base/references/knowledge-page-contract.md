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
python3 "<skill-root>/scripts/code_kb.py" check --repo . --docs docs --strict
```

Resolve `<skill-root>` to this skill's installed directory. Use `--strict` for
verification; without it, page findings are advisory. `impact --from-git` reads
staged, unstaged, and untracked changes, including both sides of renames.
Explicit `--changed-file` paths are normalized before matching.

JSON reports distinguish `ok`, `invalid` page metadata, and `error` at an effect
boundary. Missing or empty bundles, unreadable pages, invalid changed paths, and
unavailable or malformed Git status fail with a bounded `error.stage` and
`error.code`; they never emit a successful empty impact list. The advisory hook
uses the same checker, preserves the reported status, and only relaxes its exit
code. A deleted source remains in the impact result alongside its missing-path
finding.

The standard-library frontmatter reader supports the simple scalars, inline
lists, and block lists shown here; it is not a general YAML validator. Use the
repository's YAML/OKF tooling for richer syntax.
