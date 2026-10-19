# Pkl Advanced-Patterns Catalog

These patterns cross extension, I/O, packaging, or execution boundaries. Use
them only after naming the capability and proof they require.

## Table of contents

1. [Abstract and open extension points](#1-abstract-and-open-extension-points)
2. [Late-bound amendment](#2-late-bound-amendment)
3. [Generators, spreads, and conditional members](#3-generators-spreads-and-conditional-members)
4. [Glob imports and resource reads](#4-glob-imports-and-resource-reads)
5. [Dependency notation and local projects](#5-dependency-notation-and-local-projects)
6. [Package API tests](#6-package-api-tests)
7. [Multiple-file output](#7-multiple-file-output)
8. [Custom renderers and converters](#8-custom-renderers-and-converters)
9. [External modules and resource readers](#9-external-modules-and-resource-readers)
10. [Command modules](#10-command-modules)

## 1. Abstract and open extension points

Use abstract modules/classes for required specialization and open types only
where third-party extension is intentional. Keep the closed default so unknown
variants fail during evaluation.

Reference: [classes and modules](https://pkl-lang.org/main/current/language-reference/index.html).

## 2. Late-bound amendment

Use amendment to calculate defaults against the eventual consumer object while
retaining the template type. Test specialization paths because late binding can
make the evaluation context non-obvious.

Reference: [object amendment and modules](https://pkl-lang.org/main/current/language-reference/index.html).

## 3. Generators, spreads, and conditional members

Derive listings and mappings with `for`, `when`, spreads, and functions while
keeping the resulting shape typed at its consumer boundary. Prefer amendable
`Listing`/`Mapping` for templates and eager `List`/`Map` for final computed data.

Reference: [expressions and object members](https://pkl-lang.org/main/current/language-reference/index.html).

## 4. Glob imports and resource reads

Use globs for controlled fan-in when the directory is itself an owned API.
Deterministically sort/normalize resulting collections and constrain the
filesystem root so unrelated files cannot enter the model.

Reference: [imports and resources](https://pkl-lang.org/main/current/language-reference/index.html).

## 5. Dependency notation and local projects

Use named dependency notation to hide package/local-project transport from
consumers. Resolve exact versions into the lock and test both local development
and packaged dependency paths.

References: [projects and packages](https://pkl-lang.org/main/current/language-reference/index.html),
[`pkl:Project` API](https://pkl-lang.org/package-docs/pkl/current/Project/).

## 6. Package API tests

Declare `package.apiTests` to verify the public package surface during package
verification/build. Keep API tests focused on consumer-visible modules and
compatibility.

References: [`pkl:Project` API](https://pkl-lang.org/package-docs/pkl/current/Project/),
[CLI package commands](https://pkl-lang.org/main/current/pkl-cli/index.html).

## 7. Multiple-file output

Use `output.files` when one evaluated module owns several related files. Keep
paths relative to `--multiple-file-output-path` and derive extensions from each
renderer.

Reference: [module output](https://pkl-lang.org/main/current/language-reference/index.html).

## 8. Custom renderers and converters

Extend `ValueRenderer` or configure class/path converters when a built-in
format cannot represent a domain value. Test semantic conversions explicitly;
formatting convenience must not silently discard information.

References: [renderer APIs](https://pkl-lang.org/package-docs/pkl/current/),
[language reference output](https://pkl-lang.org/main/current/language-reference/index.html).

## 9. External modules and resource readers

Register an external reader only for a required custom URI scheme. Review the
host executable, bound schemes, arguments, environment, output framing, and
failure behavior; allowlist each scheme explicitly.

Reference: [resource and module contracts](https://pkl-lang.org/main/current/language-reference/index.html).

## 10. Command modules

Modules extending `pkl:Command` run through `pkl run` and can perform intended
host writes. Inspect the command module and arguments before invocation, bound
output paths, and test idempotence separately from ordinary evaluation.

References: [`pkl:Command` API](https://pkl-lang.org/package-docs/pkl/current/Command/),
[CLI run command](https://pkl-lang.org/main/current/pkl-cli/index.html).
