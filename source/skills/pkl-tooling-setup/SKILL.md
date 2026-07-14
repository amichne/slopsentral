---
name: pkl-tooling-setup
description: Set up and diagnose Pkl CLI, language-server, editor, formatter, renderer, documentation, code-generation, and build tooling. Use when installing Pkl, configuring an LSP or editor, choosing JSON/YAML output, or checking local readiness.
---

# Pkl Tooling Setup

Establish a version-aware Pkl toolchain before changing configuration. Prefer
official editor integrations over hand-built LSP clients and keep installation
writes explicit.

## Start With Evidence

Resolve this skill directory, then inspect the workspace:

```sh
<skill-dir>/scripts/pkl_tooling --workspace <repo>
<skill-dir>/scripts/pkl_tooling --workspace <repo> capabilities
```

The doctor reports the resolved Pkl and Java versions, LSP jar status, detected
editors, project and lock presence, and module/test counts. A missing Pkl CLI is
a blocking setup failure; a missing standalone LSP is not a failure when an
official editor plugin manages it.

## Configure Deliberately

1. Match documentation and integrations to `pkl --version`.
2. Ask before running package-manager, editor-extension, or download commands.
3. Prefer the native CLI; use Homebrew, Mise, WinGet, or an exact official
   release asset according to the host.
4. Prefer the official VS Code, IntelliJ, or Neovim integration. Use standalone
   `pkl-lsp` only for a custom editor client.
5. Point the editor at the same Pkl executable used by validation and sync
   `PklProject` after dependency changes.
6. Verify setup by opening a `.pkl` file, checking diagnostics/completion, and
   running the repository's real format, evaluation, and test loop.

Generate a non-mutating plan before installing:

```sh
<skill-dir>/scripts/pkl_tooling install-plan cli [--manager homebrew|mise|winget|download]
<skill-dir>/scripts/pkl_tooling install-plan lsp --editor vscode|intellij|neovim|custom
```

Read [installation-and-lsp.md](references/installation-and-lsp.md) when
installing the CLI, choosing an editor integration, configuring standalone
`pkl-lsp`, or enabling repository hooks.

Read [tooling-capabilities.md](references/tooling-capabilities.md) when choosing
renderers, transformations, docs generation, Gradle/Bazel integration,
bindings, or language code generation.

## Completion Criteria

- The resolved CLI and editor use compatible, observable versions.
- Project synchronization and CLI-path settings are explicit.
- Rendered files are derived from evaluated Pkl, not maintained as a second
  configuration authority.
- Repository entrypoints and tests run outside the editor.
- No installer, package manager, or editor state was mutated without explicit
  user intent.
