# Slopsentral

Slopsentral is the canonical marketplace for reusable local AI tooling skills,
plugins, hooks, agents, concepts, and workflow profiles.

## Choose a Plugin

Start with **Software Engineering** for code changes, tests, Git, PRs, and CI.
Keep it selected for your repository and add a specialty when the task needs one:

| Task | Add or choose |
| --- | --- |
| Kotlin and Gradle | Kotlin Engineering |
| IntelliJ Platform plugins | IntelliJ Plugin Development, plus Kotlin Engineering for Kotlin code |
| Pkl configuration | Pkl Configuration |
| OpenAPI or JSON Schema | API Contracts |
| Docs, proposals, runbooks, or documentation sites | Technical Writing; sufficient on its own for writing tasks |
| Generated code indexes and knowledge documents | Repository Knowledge; optional for ordinary coding |
| Skills, agents, hooks, and plugins | Agent Tooling |
| CLI products, shell completions, and TUIs | CLI Development |

Describe the result you want. The agent selects the relevant skills from those
plugins; you do not need to name each skill. Installation does not authorize a
push, PR, or deployment. Required Skill Read Policy is an advanced opt-in.

See the [generated catalog](source/CATALOG.md) for exact plugin IDs and contents,
the [migration guide](source/MIGRATION.md) before replacing older installations,
and the [architecture](source/ARCHITECTURE.md) for ownership contracts.
[Upstream provenance](source/UPSTREAM.md) records the guidance behind the design.

Inspect a profile without installing or executing anything:

```bash
node tools/catalog.mjs --profile kotlin-repo-default --json
```

Safely plan, apply, inspect, and reverse a named Codex user profile with the
[profile lifecycle](docs/profile-lifecycle.md). It ensures the Slopsentral
marketplace, installs selected plugins, writes a named overlay, and reports
plugin-owned hooks for manual trust review. Declared standalone skills are
installed at stable user paths and enabled or disabled in that overlay. Every
overlay mutation records a verified preimage in a versioned transaction first.

## Portable CLI

Install the CLI directly from the public GitHub repository. Node 20.11 or newer
is required:

```bash
npm install --global github:amichne/slopsentral#main
```

`#main` follows the branch. For a reproducible installation, replace it with an
immutable release tag or full commit SHA.

```bash
slopsentral doctor
slopsentral profile plan local-development-default
slopsentral profile apply local-development-default
slopsentral profile status local-development-default
```

For automatic Kotlin tooling, keep `settings.gradle.kts` at the repository root
and launch Codex through the context command:

```bash
slopsentral context launch --repo /path/to/repository
```

This selects `kotlin-repo-default`: Software Engineering and Kotlin Engineering.
Repository Knowledge remains an optional addition. It preserves other
configured plugins and applies the repository configuration before Codex starts.
The Software Engineering plugin also supplies a startup hook for desktop sessions;
configuration first written by that hook takes effect in the next session.
See [automatic repository activation](docs/profile-lifecycle.md#automatic-repository-activation)
for setup, read-only inspection, and rollback.

Use the `manifestPath` returned by `apply` to reverse that transaction:

```bash
slopsentral profile rollback /absolute/path/to/manifest.json
```

Operational commands emit stable JSON; `context launch` passes through Codex's
terminal output and exit status. Exit status `0` means success, `1`
means a runtime or I/O failure, `2` means an invalid request or contract, and
`3` means a conflict. `doctor` is read-only; a missing Codex executable is a
warning, while missing packaged assets or an unusable configuration root makes
the check fail.

Profile operations require Codex CLI 0.134.0 or newer. They leave the base user
config, foreign plugins, and Codex's runtime-owned hook trust state untouched.
Rollback reverses the generated profile overlay, not marketplace, plugin, or
standalone-skill installations.

Remove the global command without changing profiles or backups it previously
created:

```bash
npm uninstall --global slopsentral
```

## Source Of Truth

- Edit authored primitives under `source/`.
- Keep routing and quality evaluation cases under `source/evals/`; they are
  source evidence, not generated marketplace output.
- Keep source-graph schemas under `source/schemas/` and reusable validation
  utilities under `tools/`.
- Regenerate provider output with projeKtor from authored source. Both
  marketplaces are published on `main` and the dedicated harness branches.
- Prefer this repository over installed plugin caches such as
  `~/.codex/plugins/cache`.
- Do not re-own first-party or system skills here. Reference upstream
  distributions or author local rewrites with non-colliding names.

## Published Harnesses

| Harness | Branch | Marketplace entrypoint |
|---|---|---|
| Codex | `main` and [`harness/codex`](https://github.com/amichne/slopsentral/tree/harness/codex) | `.agents/plugins/marketplace.json` |
| GitHub Copilot | `main` and [`harness/github-copilot`](https://github.com/amichne/slopsentral/tree/harness/github-copilot) | `.github/plugin/marketplace.json` |

The `Publish Harnesses` workflow projects validated source with projeKtor and
publishes each dedicated output branch, then commits both generated trees to
`main` together. Authored files are preserved. Each publication commit records
the source commit in a `Source-Commit` trailer. Stale runs skip publication;
normal fast-forward pushes prevent overwriting concurrent source changes.
Generated-only pushes do not trigger another publication run.

## Standalone Skills

Install one marketplace-listed skill into `${CODEX_HOME:-$HOME/.codex}/skills`
without installing a plugin:

```bash
tools/install-skill pkl-engineering
tools/install-skill pkl-tooling-setup
tools/install-skill pkl-specification
tools/install-skill pkl-pattern-catalogs
```

The command copies a real skill directory and is an idempotent no-op when the
installed copy is current. It refuses to overwrite a different existing copy;
use `--force` only when replacement is intentional.

## Pkl Engineering Plugin

Install the complete Pkl workflow from the configured `slopsentral`
marketplace:

```bash
codex plugin add pkl-configuration@slopsentral
```

The plugin composes independently installable skills for engineering,
toolchain/LSP setup, specification and official-source navigation, and pattern
catalogs. It also provides Pkl format, explicit-entrypoint evaluation, and
sandboxed test hooks. Repositories using the evaluation hook declare directly
evaluable modules one per line in `.intelligence/pkl-entrypoints`.

## Kast MCP in Kotlin Engineering

Kotlin Engineering includes a Codex MCP connection to the locally installed
Kast runtime. Install Kast first using its [installation guide](https://kast.michne.com/start/),
then refresh and install `kotlin-engineering@slopsentral`. The plugin launches
`kast-mcp-complete` from Kast's selected user installation. The sidecar leaves
`cwd` unset so terminal Codex can pass its session directory to Kast for
Gradle-root discovery; desktop working-directory behavior still needs a native
test. A missing Kast installation causes server startup to fail; plugin
installation does not install Kast.

Kast's current installer also registers a global server named `kast`. Codex
selects that global entry when both are configured. To test the plugin-owned
connection, first inspect `codex mcp list --json` and confirm the global `kast`
command points to your Kast installation. Remove that entry with
`codex mcp remove kast`, start a fresh Codex session in a Kotlin Gradle
repository, and ask Kast to find a known class. Re-running the Kast installer
restores its global registration if needed.

## Validation

```bash
node tools/validate-source-graph.mjs
node tools/catalog.mjs --check
node tools/run-routing-evals.mjs
node tools/run-routing-evals.mjs --require-all-observed
tools/compile-kotlin-concepts
projeKtor project --source . --harness codex --out /tmp/slopsentral-codex
projeKtor project --source . --harness github-copilot --out /tmp/slopsentral-github-copilot
git diff --check
```

Use the default routing eval command as the daily-driver production gate. Use
`--require-all-observed` when promoting the full routing corpus; it fails when
any routing case lacks a replay observation.
Record real rollout and session evidence in
`source/evals/routing/field-observations.json`; source validation checks that
each observation points at an existing routing case and remains sanitized.

Each marketplace plugin has one benchmark definition in
`source/evals/plugin-benchmarks/`. Source validation requires a matching file,
a routed scenario, a disposable workspace, and non-interactive local approval.
These files are published benchmark definitions. They are not benchmark
results.

Run live benchmarks manually. Plugin Eval 0.1.2 starts a real `codex exec` and
does not have a dry-run mode. CI validates the definitions but does not execute
them. Use a temporary materialized plugin target and keep usage, result, log,
and report files in a temporary directory. Do not commit `.plugin-eval/` or raw
benchmark files. Raw files can contain prompts, response identifiers, commands,
and local paths. Do not permit remote writes unless the user approved a
disposable remote target for that run. `approvalPolicy: never` does not grant
remote-write authority.

After an authorized run, pass only its generated token-usage JSONL to
`plugin-eval analyze --observed-usage`. Chat-history demand counts are routing
evidence, not observed token usage.
