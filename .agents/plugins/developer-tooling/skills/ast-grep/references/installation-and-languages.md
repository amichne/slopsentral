# Installation and Languages

## Install the requested tool

Prefer an existing compatible installation and the repository's tool manager.
For an installation request, choose one route from the [official installation guide](https://ast-grep.github.io/guide/quick-start.html).

```sh
brew install ast-grep
```

For a project that uses npm, use its selected package scope.

```sh
npm install --save-dev @ast-grep/cli
npm exec -- ast-grep --version
```

These commands are alternatives.
Do not add npm to a project that uses another package manager solely for this tool.
For another platform, use the documented release or package for its operating system and architecture.
Record the installed package, resolved version, executable path, and installation scope.
Obey project pins before a global default.

```sh
ast-grep --version
ast-grep run --help
ast-grep scan --help
ast-grep test --help
```

Use the full executable name because `sg` can conflict with a system command.
An installed CLI does not prove editor activation.
If the user requests editor integration, use the [official integration guide](https://ast-grep.github.io/guide/tools/editors).
Examine a real rule diagnostic in the requested workspace before an activation claim.

## Start the rule server

Use the documented editor extension or the host's LSP client.
Make sure that the host can resolve the selected CLI executable.
Keep `sgconfig.yml` in the workspace root or pass its path through the supported integration.
For a standalone registration, examine the installed command first.

```sh
ast-grep lsp --help
```

Use the `ast-grep lsp` subcommand as the server command.
Pass `--config` and the selected configuration path as separate arguments when the root needs an explicit configuration.
Keep its diagnostics and code actions separate from type-aware language features.
Open a file with a known rule violation through the client.
Examine the diagnostic, correct the violation, and examine its removal.
The `lsp-management` skill supplies the client lifecycle procedure.

## Select a grammar

Consult the current [supported languages](https://ast-grep.github.io/reference/languages.html) and the installed CLI's accepted language names.
Select the exact dialect, such as TypeScript versus TSX.
Examine a representative file before a broad scan.
Keep parser failures distinct from successful scans without matches.
For embedded languages, read the project's [multi-language guide](https://ast-grep.github.io/advanced/language-injection).

For a language without built-in support, read [custom language support](https://ast-grep.github.io/advanced/custom-language.html).
Custom parsers execute native code.
Examine their origin, compatibility, and the installed version's loading policy before use.
Do not enable a custom parser as an implicit search fallback.
If no compatible grammar exists, report that limit and choose a tool with the needed syntax or semantic support.

Read the [CLI reference](https://ast-grep.github.io/reference/cli.html) for version-specific flags.
The installed executable's help output governs commands for that installation.
