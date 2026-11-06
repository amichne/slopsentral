# What you get

Slopsentral gives your coding agent reusable engineering procedures, review agents, and selected hooks.
Five plugins group those capabilities for Codex, GitHub Copilot, Amp, and Pi.

[How to install](docs/cli-install.md) · [Key aspects of the codebase](docs/codebase.md) · [Developer docs](docs/developers/contribute.md)

## Choose your plugins

Start with `software-engineering` for code work.
Add a specialty when the task needs it.
For documentation alone, select `repository-knowledge`.

| Plugin | What it supplies |
| --- | --- |
| `software-engineering` | Invariant design, tests, Python automation, Git, pull requests, issues, and CI |
| `kotlin-engineering` | Kotlin design and review, application libraries, compiler proofs, and Gradle performance |
| `intellij-plugin-development` | Plugin delivery, PSI, indexes, platform tests, and IDE diagnostics |
| `developer-tooling` | CLIs, schemas, OpenAPI, Pkl, language servers, structural search, and agent resources |
| `repository-knowledge` | Source-backed explanations, repository navigation, technical documents, glossaries, and prose assessment |

The [catalog](source/CATALOG.md) lists each plugin's exact skills and shared assets.

## Use the capabilities

Describe the task to your agent.
The installed plugins make their skills available for that task.
Skills supply procedures and references. Review agents supply focused review instructions.
Selected hooks supply context or examine configured events.
Host support differs, as the [codebase guide](docs/codebase.md#host-support) describes.

Software Engineering includes the shared engineering baseline and instruction-scope hooks.
Repository Knowledge includes knowledge hooks.
The other three plugins add no automatic hooks.

Installation makes these capabilities available.
A live host session supplies evidence that the host discovers and uses them.
Installation grants no permission to publish, deploy, or change personal configuration.

## Develop Slopsentral

Read [key aspects of the codebase](docs/codebase.md) for ownership and the path from source to installed plugins.
Use the [developer guide](docs/developers/contribute.md) for checkout setup and change-specific gates.
Read these same pages on the [public site](https://slopsentral.michne.com).
