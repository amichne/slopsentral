# Server Selection

## Select the installation owner

Read only the row for the requested language.
Read the server maintainer's current installation instructions before a package change.
Read the host's integration instructions before a configuration change.
The links identify candidates, not a fixed support ceiling or an automatic installation list.

| Language | Server or integration source | Project prerequisite to examine |
| --- | --- | --- |
| Python | [Pyright](https://github.com/microsoft/pyright) | The uv environment, interpreter, imports, and Pyright configuration |
| JavaScript, TypeScript, JSX, TSX | [typescript-language-server](https://github.com/typescript-language-server/typescript-language-server) | Node.js, TypeScript, and the selected `tsconfig.json` or `jsconfig.json` |
| Go | [gopls](https://go.dev/gopls/) | The Go toolchain, module root, and workspace configuration |
| Rust | [rust-analyzer](https://rust-analyzer.github.io/book/installation.html) | The selected Rust toolchain, standard-library sources, and Cargo workspace |
| C, C++ | [clangd](https://clangd.llvm.org/installation) | Compilation commands, include paths, and the target toolchain |
| Java | [Eclipse JDT Language Server](https://github.com/eclipse-jdtls/eclipse.jdt.ls) | The server JDK, project JDK, project import, and unique workspace data directory |
| Kotlin | [Kotlin Language Server](https://github.com/Kotlin/kotlin-lsp) | Current server limitations, supported project import, JDK, and Gradle configuration |
| Swift | [SourceKit-LSP](https://github.com/swiftlang/sourcekit-lsp) | The matching Swift toolchain and project configuration |
| Ruby | [Ruby LSP](https://shopify.github.io/ruby-lsp/) | The selected Ruby interpreter and Bundler environment |
| PHP | [Phpactor](https://github.com/phpactor/phpactor) | The PHP runtime, Composer dependencies, and project root |
| Lua | [LuaLS](https://github.com/LuaLS/lua-language-server) | The Lua version and workspace libraries |
| Bash | [Bash Language Server](https://github.com/bash-lsp/bash-language-server) | Node.js, file associations, and optional analysis dependencies |
| YAML | [YAML Language Server](https://github.com/redhat-developer/yaml-language-server) | Schema associations and the project's YAML dialect |
| HTML, CSS, JSON | [vscode-langservers-extracted](https://github.com/hrsh7th/vscode-langservers-extracted) | The selected server executable, schemas, and file associations |
| Pkl | [Pkl editor integrations](https://pkl-lang.org/lsp/current/integration.html) | The editor integration, matching runtime, and Pkl project |

These projects own their server documentation.
Community servers and extracted distributions do not become language-vendor products through this table.
For another language, find its maintained server and the host's documented integration.
Examine supported versions, platform packages, licenses, transports, and project models before selection.
If no compatible integration exists, report the unsupported language and host pair.

## Configure without toolchain drift

Prefer the repository's existing package manager and version declarations.
Resolve a requested global `latest` against current maintainer releases.
Record the resolved version after installation.
Do not replace project pins with a global default.
Do not infer the server runtime from the project's target runtime.

For Python, use the uv environment that supplies the repository's Pyright command.
The existing `python-tooling` skill owns that environment.
For Pkl, use the `pkl-engineering` installation reference and its tooling facade.
Keep its CLI, editor plugin, Java runtime, and server as distinct components.

For a GUI host, examine its actual process environment.
Do not assume an interactive shell's `PATH` reaches that host.
Use an absolute executable path when its configuration contract permits one.
Pass arguments as separate values through the host's supported configuration format.
Keep secrets outside committed configuration and logs.

## Support evidence

A language name does not establish support for every dialect, file extension, or project model.
Record the selected file types and requested capabilities.
Use documented capabilities and real workspace responses to establish the supported subset.
Keep compiler results separate from language-server results.
