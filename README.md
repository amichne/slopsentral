# Slopsentral

Slopsentral supplies focused design skills for Codex and GitHub Copilot.
Its optional in-repository Pi extension adapts the same skills and declared hooks.
Its five plugin bundles cover software design, Kotlin, IntelliJ plugins, developer tools, and repository knowledge.

[**Documentation**](https://slopsentral.michne.com) · [**Canonical release assets**](https://github.com/amichne/slopsentral/releases/latest) · [Pi guide](docs/pi-harness.md) · [Skill catalog](source/CATALOG.md)

## Use Codex or GitHub Copilot

Install the `slopsentral` marketplace for your host.
Start with Software Engineering for constrained domain design.
Use [repository procedures and native tools](docs/community-workflows.md) for general implementation, debugging, review, and delivery.
Add Kotlin Engineering for Kotlin work, then select specialties for the task.

| Host | Marketplace source | Guide |
| --- | --- | --- |
| Codex | [`harness/codex`](https://github.com/amichne/slopsentral/tree/harness/codex) | [Codex profiles and explicit setup](docs/profile-lifecycle.md) |
| GitHub Copilot | [`harness/github-copilot`](https://github.com/amichne/slopsentral/tree/harness/github-copilot) | [Harnesses and delivery paths](docs/agent-marketplaces.md) |

| Plugin | Use it for |
| --- | --- |
| Software Engineering | Constrained values, atomic predicates, pure decisions, and exhaustive handling. |
| Kotlin Engineering | Kotlin APIs, compiler proof, libraries, review, and Gradle. |
| IntelliJ Plugin Development | IntelliJ lifecycle, PSI, platform tests, and IDE diagnostics. |
| Developer Tooling | Explicit local tools, schemas, Pkl, Python, and agent resources. |
| Repository Knowledge | Source-backed knowledge, navigation, technical documents, and prose assessment. |

The [catalog](source/CATALOG.md) lists exact skill names and plugin contents.
The [migration map](source/MIGRATION.md) maps retired skills to their replacements.
Installation supplies capabilities. User requests and repository instructions control each action.

The default plugin contains one standard skill and no executable hooks or local service configuration.
The project keeps its language and toolchain choices.
Kotlin and repository knowledge remain explicit specialties.

## Optional Pi extension

Pi is an adapter for the same authored skills and hook contracts.
It is not a separate workflow bundle.
The [parity table](docs/releases.md#pi-extension-scope) names the retained behavior and its limits.
No third-party Pi extension is bundled or needed.

Use the exact archive command from the [canonical release](https://github.com/amichne/slopsentral/releases/latest).
Read the [Pi guide](docs/pi-harness.md) for profile selection and removal.

## Contribute

Use uv 0.12.9 or later, Python 3.12 or 3.13, and Pkl 0.32.0 for core projection.
Pi, Mintlify, and the retained JavaScript audits use Node.js separately.
Run the explicit checkout setup:

```bash
uv run --locked tools/setup.py
```

The default setup installs locked Python tools.
For Pi, Mintlify, and the JavaScript audits, use `uv run --locked tools/setup.py --with-host-tools`.
If you need the pinned Pkl executable, use a fresh output path:

```bash
uv run --locked tools/install_projection_pkl.py --out /tmp/slopsentral-pkl/pkl
export PKL_BIN=/tmp/slopsentral-pkl/pkl
```

Run the core gates:

```bash
uv run --locked tools/marketplace.py validate
uv run --locked tools/verify_marketplaces.py
```

For the full maintainer audit, use `npm run verify` after the host tools setup.

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
