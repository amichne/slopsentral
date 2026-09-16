# Pkl Best-Practices Catalog

This is a routing catalog. Use the linked first-party source for exact syntax
and version behavior.

## Table of contents

1. [Schema modules and amendments](#1-schema-modules-and-amendments)
2. [Constrained domain types](#2-constrained-domain-types)
3. [Typed ingestion boundaries](#3-typed-ingestion-boundaries)
4. [Fixed and constant facts](#4-fixed-and-constant-facts)
5. [One model, derived renderings](#5-one-model-derived-renderings)
6. [Project and dependency locks](#6-project-and-dependency-locks)
7. [Facts and example tests](#7-facts-and-example-tests)
8. [Least-privilege evaluation](#8-least-privilege-evaluation)
9. [Canonical formatting and style](#9-canonical-formatting-and-style)
10. [Packages instead of floating imports](#10-packages-instead-of-floating-imports)
11. [Editor and project synchronization](#11-editor-and-project-synchronization)
12. [Generated host-language types](#12-generated-host-language-types)

## 1. Schema modules and amendments

Define reusable typed properties in a template and consume it with `amends`
when callers must preserve that module type. Evaluation then rejects unknown,
missing, or constrained values at the configuration boundary.

References: [modules, amendments, and classes](https://pkl-lang.org/main/current/language-reference/index.html),
[Pkl tutorial](https://pkl-lang.org/main/current/introduction/index.html).

## 2. Constrained domain types

Use classes and constrained type aliases for semantic values instead of passing
raw strings or numbers through the model. Prefer literal unions for closed
variants and nested constraints for legal ranges.

References: [type system](https://pkl-lang.org/main/current/language-reference/index.html),
[standard-library base types](https://pkl-lang.org/package-docs/pkl/current/base/).

## 3. Typed ingestion boundaries

Parse JSON, YAML, environment, or reader output at one edge. Convert `Dynamic`
to a typed class before downstream use so evaluation owns validation.

References: [language reference](https://pkl-lang.org/main/current/language-reference/index.html),
[first-party package index](https://pkl-lang.org/package-docs/).

## 4. Fixed and constant facts

Use `fixed` to prevent later amendment and `const` when a fact must also be
independent of non-constant state. Do not rely on comments to freeze policy.

Reference: [language reference](https://pkl-lang.org/main/current/language-reference/index.html).

## 5. One model, derived renderings

Keep one typed `output.value` and select JSON, YAML, properties, XML, or another
renderer for each consumer. Generated formats should not become competing
authored sources.

References: [CLI formats](https://pkl-lang.org/main/current/pkl-cli/index.html),
[module output](https://pkl-lang.org/main/current/language-reference/index.html).

## 6. Project and dependency locks

Declare dependencies, tests, evaluator settings, and package metadata in
`PklProject`. Resolve through the CLI and review `PklProject.deps.json` as the
exact dependency lock.

References: [`pkl:Project` API](https://pkl-lang.org/package-docs/pkl/current/Project/),
[CLI project commands](https://pkl-lang.org/main/current/pkl-cli/index.html).

## 7. Facts and example tests

Use `facts` for logical assertions and `examples` for structured/rendered
snapshots. Run checks in a sandbox because missing or mismatched expectations
can write files; update snapshots only as an explicit reviewed mutation.

References: [`pkl:test` API](https://pkl-lang.org/package-docs/pkl/current/test/),
[CLI test command](https://pkl-lang.org/main/current/pkl-cli/index.html).

## 8. Least-privilege evaluation

Constrain root directories, module/resource allowlists, environment names, and
external properties. Treat HTTPS, external readers, and project evaluator
settings as capabilities that require review.

References: [CLI common options](https://pkl-lang.org/main/current/pkl-cli/index.html),
[Pkl concepts and isolation](https://pkl-lang.org/main/current/introduction/concepts.html).

## 9. Canonical formatting and style

Use `pkl format` as the mechanical authority and the version-matched style guide
for naming, declarations, comments, and layout.

References: [style guide](https://pkl-lang.org/main/current/style-guide/index.html),
[formatter CLI](https://pkl-lang.org/main/current/pkl-cli/index.html).

## 10. Packages instead of floating imports

Publish reusable modules as packages, resolve semantic versions through a
project, and retain checksums. Prefer dependency notation over unpinned HTTPS
imports.

References: [packages](https://pkl-lang.org/main/current/language-reference/index.html),
[package index](https://pkl-lang.org/package-docs/).

## 11. Editor and project synchronization

Use an official editor integration and point it at the same CLI used in tests.
Sync the workspace after project dependency changes and verify diagnostics with
CLI evaluation rather than treating editor state as proof.

References: [VS Code](https://pkl-lang.org/vscode/current/index.html),
[IntelliJ](https://pkl-lang.org/intellij/current/index.html),
[Neovim](https://pkl-lang.org/neovim/current/index.html).

## 12. Generated host-language types

Generate host types when consumers benefit from compile-time access to a stable
Pkl model. Keep generation reproducible and validate both Pkl evaluation and
host compilation.

References: [binding specification](https://pkl-lang.org/main/current/bindings-specification/index.html),
[apple/pkl-go](https://github.com/apple/pkl-go),
[apple/pkl-swift](https://github.com/apple/pkl-swift).
