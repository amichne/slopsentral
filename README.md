# Slopsentral

Slopsentral ships five plugins and 28 skills for Kotlin-first engineering.
The shared rules prioritize safety, correctness, proof, scope, pure functions, and atomic units.
New automation uses locked uv Python environments.

Start with the [source-backed OpenWiki quickstart](openwiki/quickstart.md) for
authoring, projection, validation, installation, and release workflows.
The wiki uses OKF pages and OpenWiki-managed Claims. It reuses the
[repository glossary](docs/GLOSSARY.md).
See [documentation updates](openwiki/workflows/documentation.md) for the
review-only GitHub Action and required secrets.

## Choose a plugin

Start with Software Engineering and Kotlin Engineering for Kotlin work.
Add a specialty only for the requested task.

| Plugin | Purpose | Skills |
| --- | --- | --- |
| Software Engineering | Proof-preserving design, tests, Python automation, Git, PRs, and CI | 8 |
| Kotlin Engineering | Kotlin design, review, application libraries, compiler proof, and Gradle | 6 |
| IntelliJ Plugin Development | Plugin delivery, PSI/indexing, and platform tests with live diagnostics | 3 |
| Developer Tooling | CLIs, agent resources, schemas, OpenAPI, Pkl, and personal configuration | 8 |
| Repository Knowledge | Source-backed knowledge, navigation, technical documents, and prose assessment | 4 |

Python Tooling appears in two bundles. The marketplace has 28 unique skills.
The [catalog](source/CATALOG.md) gives exact identifiers and composition.
The [migration map](source/MIGRATION.md) lists every retired skill and its replacement.

Installation makes a skill available. It grants no authority to publish, deploy, or change personal configuration.
Developer Tooling adds no automatic hooks. Repository Knowledge remains optional for Kotlin work.

For Pi, use the [published installer](docs/pi-install.md).
It selects the latest stable release by default.

All provider releases and authored plugins share one Slopsentral version.
See [Release Please, version policy, and required App setup](docs/releases.md).

## Use Slopsentral in Amp

Amp provides native skill discovery and turn-start instructions, without
automatic hooks, workflow profiles, custom modes, or MCP connections.
From a prepared checkout, generate the complete directory plugins:

```bash
node tools/project-marketplaces.mjs --source . --harness amp --out /tmp/slopsentral-amp-new
```

Copy selected complete bundles from the output's `.amp/plugins/` into your
project's `.amp/plugins/`, without replacing existing directories. Start with
`software-engineering`; add `kotlin-engineering` for Kotlin. Reload Amp plugins.
Do not copy only `index.js`: skills, scripts, references, and instructions travel together.
Use `amp skill info software-engineering:semantic-ratchet` to check discovery.

Each bundle declares its limits in `capabilities.json`. Publication targets
`harness/amp`, not `main`, so this checkout does not activate every bundle.
See [installation, updates, rollback, and native checks](docs/pkl-projection.md#amp-native-plugins).

## Automation

Install uv 0.12.9 or newer. Run the checkout setup and its gates:

```text
uv run --locked tools/setup.py
uv run --locked tools/check.py
npm run verify
```

The project locks Pyright, Ruff, pytest, PyYAML, and the optional LibCST group.
Portable Python scripts declare PEP 723 metadata and adjacent locks.
The configuration disables source builds with `tool.uv.no-build = true`.

New automation uses strict types, finite outcomes, literal argument arrays, and focused tests.
The explicit include lists in `pyproject.toml` define strict Pyright and Ruff coverage.
Older Python helpers retain their tests but do not all meet that strict coverage.
Kotlin compilers, Pkl evaluation, and Node schema tools keep their own contracts.
The parent-shell history adapter remains because a child process cannot read that state.

For one skill without a plugin, use:

```text
uv run --locked tools/install_skill.py pkl-engineering
```

The installer rejects conflicting local content. It copies no generated plugin payload into authored source.

## Source and delivery

Author skills, hooks, concepts, agents, schemas, and plugin references under `source/`.
Keep shared maintenance tools under `tools/`.
Plugins reference canonical primitives. They do not own copies of those primitives.
Installed caches and generated provider trees remain consumers.

Software Engineering delivers concise policies through its context hook.
That hook covers startup, resume, clear, and compact.
Kotlin Engineering selects no hooks. Its skills carry the Kotlin guidance when selected.
Negative Capability Proof supports implicit selection. Kotlin Gradle Validation needs explicit user selection.
The four Kotlin hook primitives remain available for explicit custom compositions.
Their output does not prove that the host consumed the policy or that a model obeyed it.
Full procedures and examples remain in task-selected skills and references.

Software Engineering also composes [scope maintenance for `AGENTS.md`](docs/agents-md-scope.md).
That hook requests source-backed instruction updates and permits a documented no-change review.

Standalone source, Pkl, API-context, and skill-read hooks remain explicit primitives.
The five plugin bundles do not select those hooks.
A repository must explicitly compose a hook before it can use that automatic behavior.
The historical `pkl-checked-repository` profile now selects guidance only.

Profiles select plugins without implicit installation or startup mutation.
Inspect the Kotlin selection with:

```text
node tools/catalog.mjs --profile kotlin-repo-default --json
```

Use the [profile lifecycle](docs/profile-lifecycle.md) for explicit setup and saved transaction rollback.
Use the upstream Worktrunk plugin for worktree automation.
The [Worktrunk procedure](docs/worktrunk-automation.md) describes project setup and gates.

The local Pkl projector creates Codex and GitHub Copilot output from authored source.
Publication updates `.agents/plugins` and `.github/plugin` on `main` and the corresponding harness branches.
Local edits and temporary projections do not publish those trees or change installed caches.
Read the [architecture](source/ARCHITECTURE.md) for ownership and evidence limits.

## Local evidence

The projector needs Node.js 22.22.0 or later, locked dependencies, and Pkl 0.32.0.
Install its pinned runtime explicitly:

```text
npm ci
node tools/install-projection-pkl.mjs --out /tmp/slopsentral-pkl/pkl
```

For projection alone, `npm ci --omit=dev --ignore-scripts` installs the schema dependencies without the evaluation toolchain.
The full maintainer suite needs the development dependencies.
See [download and dependency failures](docs/pi-install.md#download-failures) for certificate, proxy, and registry errors.

Set `PKL_BIN` to that executable in the process environment.
Use fresh output paths for each projection.

```text
node tools/validate-source-graph.mjs
node tools/catalog.mjs --check
node tools/run-routing-evals.mjs --require-all-fixtures
uv run --locked tools/compile_kotlin_concepts.py
uv run --locked tools/verify_marketplaces.py
git diff --check
```

The catalog test caps the distribution at five plugins and 30 skills.
It also rejects hidden discoverable skill directories and unrelated hooks in Kotlin defaults.
Graph and projection tests reject duplicate identities, conflicting paths, cycles, and duplicate hook selection.
Compiler and schema examples exercise legal values and forbidden calls.

Golden routing fixtures express expected contracts. They do not record model behavior.
Field records keep historical route identities and evidence.
Records whose skills retired need a fresh replay before they support the replacement route.
Plugin execution definitions live under `source/evals/promptfoo/execution/`.
No live model benchmark runs during the normal gates.

Run `npm run check:evals` for offline promptfoo controls.
Run `npm run eval:skills` for 22 live decision cases across ten skills, each
paired with a no-skill control. This includes the ten session-grounded
regressions from #102; their historical tool-run audit remains separate.
Run `npm run eval:execution` for all 45 plugin execution scenarios. Supply an
ignored fixture registry through `SLOPSENTRAL_EXECUTION_FIXTURES`; cases without
ready fixtures record nonpassing `BLOCKED_SETUP` without a model call. Each ready
case needs an isolated worktree, a real tool trace, and independent host verification.
No ready fixture is currently supplied, so the integration claims no live passes
or measured improvement. Execution reports use `.promptfoo/results/execution.json`;
retained evidence stays under ignored `.promptfoo/execution/`.
Read [the skill eval guide](docs/skill-evals.md) for setup, reports, and evidence limits.

## Kast

Kotlin Engineering retains its existing Kast MCP connection.
Kast owns runtime installation and workspace discovery.
Examine the configured server and use a fresh semantic query before a claim of installed readiness.
Plugin installation alone proves neither runtime availability nor workspace enrollment.
