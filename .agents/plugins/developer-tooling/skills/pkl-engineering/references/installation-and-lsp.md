# Pkl Installation and LSP Setup

Use this reference to establish a reproducible local development loop. These
commands are routes to first-party surfaces, not a substitute for checking the
versioned documentation that matches the installed Pkl release.

## CLI installation

The official CLI documentation supports native binaries and the following
package-manager paths:

| Host strategy | Installation route | Verification |
| --- | --- | --- |
| Homebrew on macOS/Linux | `brew install pkl` | `pkl --version` |
| Mise on supported hosts | `mise use pkl@<version>` | `mise current pkl` and `pkl --version` |
| WinGet on Windows | `winget install Apple.Pkl` | `pkl --version` |
| Exact binary | Match OS/architecture at the official release | Verify executable and `pkl --version` |
| Java CLI | Use the version-matched Maven artifact | Verify the documented Java runtime and `jpkl --version` |

Source: [official Pkl CLI installation and reference](https://pkl-lang.org/main/current/pkl-cli/index.html).

Do not paste a floating download URL into automation. Pin a release version and
verify its checksum or package-manager receipt when reproducibility matters.

## Editor integrations

### VS Code

- Install the release VSIX from
  [apple/pkl-vscode releases](https://github.com/apple/pkl-vscode/releases/latest).
- Configure `pkl.cli.path` when the CLI is outside `PATH`.
- Configure `pkl.lsp.java.path` when Java is outside `PATH` and `JAVA_HOME`.
- Run `Pkl: Sync projects` after changing project dependencies.
- Verify highlighting, diagnostics, hover, completion, and go-to-definition on
  a real project module.

See the [current VS Code installation](https://pkl-lang.org/vscode/current/installation.html)
and [feature reference](https://pkl-lang.org/vscode/current/features.html).

### IntelliJ Platform

- Install the Pkl plugin from the JetBrains Marketplace or the official Apple
  update repository described by the installation page.
- Configure the same CLI version used by repository validation.
- Mark Pkl source roots where appropriate and sync the project after dependency
  changes.
- Verify inspection diagnostics, completion, navigation, and formatter output.

See the [current IntelliJ installation](https://pkl-lang.org/intellij/current/installation.html)
and [feature reference](https://pkl-lang.org/intellij/current/features/index.html).

### Neovim

Use the [official apple/pkl-neovim plugin](https://github.com/apple/pkl-neovim)
and its versioned [installation guide](https://pkl-lang.org/neovim/current/installation.html).
Standard Vim is not the supported surface.

## Custom LSP client

`pkl-lsp` is a low-level editor integration component, not a general validation
command. A custom client should:

1. obtain the jar from an exact
   [apple/pkl-lsp release](https://github.com/apple/pkl-lsp/releases/latest);
2. meet the Java requirement documented for that LSP version;
3. launch `java -jar <path-to-pkl-lsp.jar>`;
4. preserve `pkl-lsp:` URIs for standard-library and non-file sources;
5. implement project sync and package-download requests if those capabilities
   are advertised; and
6. expose `pkl.cli.path`, formatter grammar version, excluded project
   directories, and module paths through `workspace/configuration`.

The authoritative protocol and client settings are in the
[Pkl LSP integration reference](https://pkl-lang.org/lsp/current/integration.html).

## Repository hook setup

The dedicated plugin provides format, evaluation, and test hook primitives.
Evaluation roots are intentionally explicit. Add one repository-relative module
per line:

```text
# .intelligence/pkl-entrypoints
config/dev.pkl
config/prod.pkl
```

Only modules that can be evaluated directly belong here. Templates, abstract
modules, and library-only modules should be exercised through their consumers
or tests instead of being guessed by a hook.
