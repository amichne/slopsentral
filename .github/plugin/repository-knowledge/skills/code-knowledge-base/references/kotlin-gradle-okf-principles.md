# Kotlin/Gradle OKF Principles

Use this reference when producing Open Knowledge Format bundles for
Kotlin/Gradle repositories.

## Producer Goals

The output is an OKF bundle: a directory of Markdown files where each
non-reserved concept document starts with YAML frontmatter containing a
non-empty `type`. The bundle should remain useful in a plain Git checkout,
without a provider SDK, runtime cache, vector store, or generated database.

For Kotlin/Gradle projects, the producer should explain the codebase through
concepts that map to stable engineering boundaries:

- Gradle root project, included builds, subprojects, convention plugins, and
  source sets.
- Public Kotlin APIs, package boundaries, service interfaces, serializers,
  schemas, command surfaces, and generated contracts.
- Runtime flows such as CLI commands, RPC routes, daemon lifecycles, build
  tasks, release paths, and test contracts.
- Cross-cutting glossary terms that agents need before changing code.

## OKF Concept Shape

Use standard OKF frontmatter fields first:

```yaml
---
type: Kotlin Module
title: Analysis API
description: Shared compiler-backed analysis contracts and serializable models.
resource: file://analysis-api
tags: [kotlin, gradle, api]
timestamp: 2026-06-17T00:00:00Z
code_sources:
  - path: analysis-api/src/main/kotlin/example/AnalysisBackend.kt
    symbols: [AnalysisBackend]
    lines: "22-140"
---
```

`code_sources` is a producer-defined extension. Consumers must preserve unknown
fields, so the extension should be useful but not required for basic OKF
consumption.

## Evidence Rules

- Prefer semantic facts from compiler, LSP, source-index, or build tools when
  they are available.
- Fall back to deterministic repository signatures when semantic tooling is not
  available.
- Cite source paths, generated contracts, schemas, commands, and test fixtures
  close to the claim they support.
- Use `# Citations` for external or cross-bundle sources. Use bundle-relative
  Markdown links for relationships between concepts.
- Do not present generated build output as source unless the repository treats
  it as checked or reproducible contract material.

## Directory Guidance

Organize the bundle for progressive disclosure rather than mirroring every
source directory:

```text
okf/
├── index.md
├── modules/
│   ├── index.md
│   └── analysis-api.md
├── flows/
│   └── request-dispatch.md
├── contracts/
│   └── json-rpc.md
└── glossary/
    └── capability.md
```

Use `index.md` for directory listings and `log.md` for update history. Do not
use reserved filenames as concept documents.

## Impact Rules

- A changed file impacts every concept that lists it in `code_sources`.
- A changed Gradle convention, catalog, schema generator, or command catalog
  may impact many concepts; record that relationship in body links or
  `code_sources`.
- A renamed source path should update frontmatter before the concept is
  considered current.
- Missing optional OKF fields should not block consumption. Missing or empty
  `type` should fail strict producer validation.
