# Official Pkl Source Map

Use versioned documentation for released behavior and repository source for
implementation detail, examples, or facts not covered by public docs. Record an
exact commit when conclusions depend on source.

## Documentation authorities

| Question | Start here |
| --- | --- |
| Language syntax and semantics | [Language reference](https://pkl-lang.org/main/current/language-reference/index.html) |
| CLI flags, evaluation, tests, packages | [CLI reference](https://pkl-lang.org/main/current/pkl-cli/index.html) |
| Standard-library APIs | [Pkl package docs](https://pkl-lang.org/package-docs/pkl/current/) |
| First-party reusable packages | [Package index](https://pkl-lang.org/package-docs/) |
| Style | [Style guide](https://pkl-lang.org/main/current/style-guide/index.html) |
| Release behavior | [Release notes](https://pkl-lang.org/main/current/release-notes/index.html) |
| Custom editor/LSP integration | [LSP integration](https://pkl-lang.org/lsp/current/integration.html) |
| Host-language embedding | [Binding specification](https://pkl-lang.org/main/current/bindings-specification/index.html) |

Replace `current` with the version matching `pkl --version` when a stable
release page is available.

## Core and specification repositories

| Repository | Use it for |
| --- | --- |
| [apple/pkl](https://github.com/apple/pkl) | Language, CLI, standard library, tests, Gradle plugin, pkldoc, JVM tooling |
| [apple/pkl-lang.org](https://github.com/apple/pkl-lang.org) | Website source and documentation construction |
| [apple/pkl-evolution](https://github.com/apple/pkl-evolution) | Proposed and accepted language evolution (SPICEs) |
| [apple/pkl-package-docs](https://github.com/apple/pkl-package-docs) | First-party package-doc generation and publication |

## Editor and language-server repositories

| Repository | Use it for |
| --- | --- |
| [apple/pkl-lsp](https://github.com/apple/pkl-lsp) | Server implementation, releases, protocol behavior |
| [apple/pkl-vscode](https://github.com/apple/pkl-vscode) | VS Code packaging, settings, commands, version matrix |
| [apple/pkl-intellij](https://github.com/apple/pkl-intellij) | IntelliJ inspections, navigation, formatter, project sync |
| [apple/pkl-neovim](https://github.com/apple/pkl-neovim) | Neovim installation and LSP client configuration |

## Packages and resource definitions

| Repository | Use it for |
| --- | --- |
| [apple/pkl-pantry](https://github.com/apple/pkl-pantry) | Shared package models, pipelines, formats, CI and API definitions |
| [apple/pkl-k8s](https://github.com/apple/pkl-k8s) | Typed Kubernetes resource definitions and generators |
| [apple/pkl-readers](https://github.com/apple/pkl-readers) | External resource reader implementations and protocols |

## Bindings, builds, and integrations

| Repository | Use it for |
| --- | --- |
| [apple/pkl-go](https://github.com/apple/pkl-go) | Go evaluator API and code generation |
| [apple/pkl-swift](https://github.com/apple/pkl-swift) | Swift evaluator API and code generation |
| [apple/pkl-spring](https://github.com/apple/pkl-spring) | Spring Boot configuration integration |
| [apple/rules_pkl](https://github.com/apple/rules_pkl) | Bazel evaluation, testing, docs, and code generation |

## First-party example repositories

- [apple/pkl-go-examples](https://github.com/apple/pkl-go-examples)
- [apple/pkl-jvm-examples](https://github.com/apple/pkl-jvm-examples)
- [apple/pkl-swift-examples](https://github.com/apple/pkl-swift-examples)
- [apple/pkl-k8s-examples](https://github.com/apple/pkl-k8s-examples)

Examples demonstrate a versioned technique; they do not override the language,
CLI, or binding specifications.

## Local indexing workflow

Use `scripts/pkl_sources catalog` to see the machine-readable declared set.
`sync` accepts only declared `https://github.com/apple/*` repositories by
default, records exact commits, and keeps upstream files in an external cache.
`index` parses documentation headings and Pkl declarations from the locked
checkouts. Use `--source <id>` to keep research narrow.
