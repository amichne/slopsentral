# Pkl Projects, Security, and Interoperability

Use this reference when the task crosses a single evaluated module.

## Project and package operations

- `PklProject` owns project dependencies, shared evaluator settings, test
  entrypoints, and package metadata. `PklProject.deps.json` is the resolved lock
  and should change only through `project resolve`.
- Dependency resolution chooses a compatible declared version; it is not a
  general dependency add, remove, or update command.
- Package verification/build runs API tests, checks package-local imports, and
  checks already-published metadata compatibility. It prepares metadata, ZIP,
  and SHA-256 artifacts; it does not publish them.
- Keep the publish check enabled. Treat `--skip-publish-check` as a separate,
  explicitly justified native Pkl escape hatch.

## Evaluator capabilities

The façade defaults to `agent-safe`:

- file modules stay under `--workspace` through `--root-dir`;
- Pkl standard modules, local modules, module paths, packages, and project
  packages remain allowed;
- direct HTTPS modules and ambient environment resources are denied;
- evaluation-style commands omit project evaluator settings, while project
  commands receive explicit root and allowlist flags that settings cannot widen;
- named environment variables, properties, module patterns, and resource
  patterns must be explicitly added.

Package resolution may still use the network to fetch checksum-verified package
artifacts. Package verification evaluates `PklProject` first and allowlists only
the package's derived metadata URL and declared ZIP URL for its publish check.
Use the project policy only when repository-owned evaluator settings are the
intended authority and have been inspected.

Do not pass secrets through HTTP headers or command-line properties without
considering process listings and logs. External module/resource readers execute
host programs and therefore remain outside the façade.

## Advanced native boundaries

- `pkl run` executes modules extending `pkl:Command`. These commands can write
  any absolute path permitted to the user, so inspect the command module and
  invoke it directly only when that write authority is intended.
- `pkl repl` is interactive and is not an agent automation surface.
- `pkl server` is the protocol boundary used by language bindings, not a
  developer validation command.
- `pkldoc`, the Java/Kotlin code generators, Swift/Go/JVM bindings, and the Pkl
  language server are separate tools with separate runtime/version contracts.
  Route to their versioned official documentation rather than guessing flags.
- Pkl has no native TOON renderer, project-wide static typecheck, semantic lint,
  project initializer, dependency add/remove/update, or package uploader. The
  façade converts its own result envelopes to TOON and does not invent those
  missing capabilities.

## Versioned sources

- [Pkl 0.32 CLI reference](https://pkl-lang.org/main/0.32.0/pkl-cli/index.html)
- [`pkl:Project` package docs](https://pkl-lang.org/package-docs/pkl/0.32.0/Project/index.html)
- [Pkl 0.32 release notes](https://pkl-lang.org/main/0.32.0/release-notes/0.32.html)
- [Pkl language server integration](https://pkl-lang.org/lsp/current/integration.html)
