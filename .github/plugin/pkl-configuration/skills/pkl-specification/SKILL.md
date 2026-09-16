---
name: pkl-specification
description: Model Pkl specifications, resources, imports, packages, and provenance, and locate authoritative Pkl documentation or repository content. Use when defining configuration schemas, resource boundaries, source maps, or first-party research inputs.
---

# Pkl Specification

Turn configuration requirements into typed Pkl contracts and route semantic
questions to exact first-party sources. Treat remote material as provenance,
not local canonical content.

## Specify the Boundary

1. Identify consumers, directly evaluable entry modules, reusable templates,
   external inputs, and rendered outputs.
2. Express required facts with typed properties, classes, constrained aliases,
   amendments, and tests.
3. Classify every input as a module or resource and name the URI scheme and
   capability it requires.
4. Keep `Dynamic`, environment, network, and external-reader behavior at a
   conversion boundary.
5. Record the versioned official documentation or exact repository commit that
   supports non-obvious semantics.

Read [specification-and-resources.md](references/specification-and-resources.md)
when designing modules, resources, dependency notation, readers, or rendered
outputs.

Read [official-source-map.md](references/official-source-map.md) when deciding
which documentation site, implementation repository, package library, editor,
binding, or example repository is authoritative.

## Build a Local Evidence Index

The bundled manifest declares public Apple repositories and the content paths
worth indexing. Network and filesystem writes are explicit:

```sh
<skill-dir>/scripts/pkl_sources catalog
<skill-dir>/scripts/pkl_sources sync --cache <cache-dir> [--source <id>]
<skill-dir>/scripts/pkl_sources index --cache <cache-dir> --out <index.json> [--source <id>]
```

`sync` writes `sources.lock.json` with exact commits. `index` refuses unlocked
or drifted checkouts and emits deterministic JSON containing documentation
headings plus Pkl module, class, and type-alias symbols. Raw upstream content
stays in the caller-selected cache and is never promoted into this skill.

## Completion Criteria

- Entry modules, templates, inputs, outputs, and consumers are distinguished.
- Resource and evaluator capabilities are least-privilege and explicit.
- Dynamic data becomes typed before it crosses the specification boundary.
- Semantics cite version-matched docs or an exact first-party source commit.
- Synced research content remains cached evidence, not copied canonical policy.
