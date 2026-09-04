---
name: pkl-pattern-catalogs
description: Route Pkl design work to concise best-practice and advanced-pattern reference catalogs. Use when choosing a Pkl modeling pattern, reviewing configuration design, or looking for versioned official examples without loading a large monolithic skill.
---

# Pkl Pattern Catalogs

Choose the smallest relevant catalog, confirm the pattern against the installed
Pkl version, and prove it by evaluating the real consumer module.

## Route the Work

Read [best-practices.md](references/best-practices.md) for common module design,
constraints, amendments, projects, tests, rendering, and editor workflows.

Read [advanced-patterns.md](references/advanced-patterns.md) for extension
points, late binding, generators, package APIs, multi-file output, custom
renderers, external readers, command modules, bindings, and code generation.

## Apply a Pattern

1. Name the invariant or consumer problem before selecting a pattern.
2. Follow the catalog link to version-matched official documentation or an
   exact first-party repository commit.
3. Keep the smallest type and capability boundary that enforces the invariant.
4. Add a failing evaluation or test for the behavior, then implement it.
5. Report the evaluated entrypoint, test, renderer, and enabled capabilities.

## Completion Criteria

- The selected pattern solves a stated configuration problem.
- Versioned first-party evidence supports its semantics.
- Evaluation or `pkl:test` proves the behavior at a real entrypoint.
- Dynamic values, remote inputs, readers, and write-capable commands remain
  explicit boundaries.
