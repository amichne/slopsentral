# Slopsentral

Slopsentral supplies Kotlin-first skills and engineering rules for Pi, Codex, and GitHub Copilot.
Its five plugin bundles cover software design, Kotlin, IntelliJ plugins, developer tools, and repository knowledge.

[**Get the latest Pi release**](https://github.com/amichne/slopsentral/releases/latest) · [Pi guide](docs/pi-harness.md) · [Skill catalog](source/CATALOG.md)

## Use Slopsentral in Pi

Use Pi 1.2.0 with Node.js 22.19 or later.
The package needs no repository clone, Pkl, or local npm build.

1. Open the [latest Pi release](https://github.com/amichne/slopsentral/releases/latest).
2. Run the `pi install` command from its release notes.
3. From your project, start Pi with the Kotlin design profile:

```bash
pi --slopsentral-profile kotlin-type-design
```

The release command selects an exact archive version in your personal Pi settings.
For a project installation, add `--local` after `pi install`.
Choose one installation scope.
To update, use the command from a newer release in the same scope.
`pi update --extensions` does not discover newer GitHub release URLs.

The Kotlin design profile supplies Kotlin instructions and selected skills with automatic hooks set to `OFF`.
Inside Pi, use these commands:

| Command | Result |
| --- | --- |
| `/slopsentral-profile` | Show the current profile and available choices. |
| `/slopsentral-profile kotlin-type-design` | Select Kotlin design skills with automatic hooks set to `OFF`. |
| `/slopsentral-profile type-design` | Add schema, OpenAPI, and Pkl skills with automatic hooks set to `OFF`. |
| `/slopsentral-profile kotlin-repo-default` | Select Kotlin and Software Engineering with `ADVISORY` hooks. |
| `/slopsentral-check` | Run the selected completion gates explicitly. |
| `/slopsentral-profile off` | Turn off Slopsentral prompt instructions, advertised skills, and automatic hooks. |

Change profiles after the current run ends.
The selection persists on the active session branch.
A new session without a profile choice uses `local-development-default` with `ADVISORY` hooks.
Hook commands need their own tools, including uv for Python hooks.
Profiles keep the current model and tool set.

The [Pi guide](docs/pi-harness.md) covers installation scopes, updates, removal, hook policies, and adapter limits.
Each release includes `SHA256SUMS`, `candidate.json`, and `promotion.json` beside the archive.

## Use Codex or GitHub Copilot

Install the `slopsentral` marketplace for your host.
Start with Software Engineering for code work.
Add Kotlin Engineering for Kotlin work, then select specialties for the task.

| Host | Marketplace source | Guide |
| --- | --- | --- |
| Codex | [`harness/codex`](https://github.com/amichne/slopsentral/tree/harness/codex) | [Codex profiles and explicit setup](docs/profile-lifecycle.md) |
| GitHub Copilot | [`harness/github-copilot`](https://github.com/amichne/slopsentral/tree/harness/github-copilot) | [Harnesses and delivery paths](docs/agent-marketplaces.md) |

| Plugin | Use it for |
| --- | --- |
| Software Engineering | Typed design, tests, Python automation, Git, pull requests, and CI. |
| Kotlin Engineering | Kotlin APIs, compiler proof, libraries, review, and Gradle. |
| IntelliJ Plugin Development | IntelliJ lifecycle, PSI, platform tests, and IDE diagnostics. |
| Developer Tooling | CLIs, schemas, OpenAPI, Pkl, agent resources, and personal configuration. |
| Repository Knowledge | Source-backed knowledge, navigation, technical documents, and prose assessment. |

The [catalog](source/CATALOG.md) lists exact skill names and plugin contents.
The [migration map](source/MIGRATION.md) maps retired skills to their replacements.
Installation supplies capabilities. User requests and repository instructions control each action.

Kotlin Engineering declares a Kast MCP connection for Codex.
Pi keeps that configuration as reference material without a server connection.
Kast owns runtime installation and workspace discovery.
Plugin installation alone does not prove that Kast serves the current workspace.

## Contribute

Use Node.js 22.19 or later and uv 0.12.9 or later.
The tools need Python 3.12 or 3.13 and Pkl 0.32.0.
Run the explicit checkout setup:

```bash
uv run --locked tools/setup.py
```

The setup installs locked Python and Node dependencies.
If you need the pinned Pkl executable, use a fresh output path:

```bash
node tools/install-projection-pkl.mjs --out /tmp/slopsentral-pkl/pkl
export PKL_BIN=/tmp/slopsentral-pkl/pkl
```

Run the repository gates:

```bash
npm run verify
```

For a focused change, use the checks in [AGENTS.md](AGENTS.md) and the affected source scope.
The [projection guide](docs/pkl-projection.md) describes fresh output paths and provider contracts.

Author skills, hooks, instructions, agents, profiles, and schemas under `source/`.
Keep shared tools under `tools/`.
Plugins reference canonical primitives.
Generated provider trees and installed caches remain consumers.
New Python automation uses uv, locked dependencies, strict Pyright, Ruff, pytest, and `tool.uv.no-build = true`.

Publication updates the generated Codex and GitHub Copilot trees on `main` and their harness branches.
Pi releases promote one tested archive through GitHub Releases.
The [architecture](source/ARCHITECTURE.md) explains source ownership and proof limits.
Native host tests cover adapter behavior. They do not prove that a model obeys instructions or selects the intended skill.
