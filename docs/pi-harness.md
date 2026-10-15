# Pi harness

Project Slopsentral into one Pi package with native commands, prompt instructions, skills, and event handlers.
The compatibility target is Pi 1.2.0.
The package uses Pi's TypeScript extension API.

## Install the published package

Use an existing Pi installation with Node.js 22.19 or later.
Run this command without a source checkout, Pkl, or npm build:

```bash
pi install npm:slopsentral-pi@https://github.com/amichne/slopsentral/releases/download/pi-v0.1.0/slopsentral-pi-0.1.0.tgz
```

Start `pi` in your project.
Select `/slopsentral-kotlin-type-design` for a first trial without automatic hooks.
The other source profiles remain available through `/slopsentral-profile`.
Hook actions need their documented tools, including uv for Python hooks.

Pi downloads the archive through npm and keeps it in its managed package directory.
The package has no install scripts or runtime dependencies.
Pi supplies its own host APIs.
The [release](https://github.com/amichne/slopsentral/releases/tag/pi-v0.1.0) includes `SHA256SUMS` and the exact source commit.

The URL selects one release.
To change releases, install the named package with the new release URL.
`pi update --extensions` does not discover newer GitHub release URLs.
To remove the package, run:

```bash
pi remove npm:slopsentral-pi
```

## Local trial

Use Node.js 22.19 or later, uv 0.12.9 or later, and Pkl 0.32.0.
Install the locked Node dependencies with `npm ci`.
If the pinned executable is absent, use the [Pkl setup procedure](pkl-projection.md#runtime-and-commands).
Keep the selected hook scripts, adjacent lock files, and their tool prerequisites together.
The package does not install these tools.

From the source checkout, select a fresh output path:

```bash
export PKL_BIN=/absolute/path/to/pkl-0.32.0
node tools/project-marketplaces.mjs --source . --harness pi --out /tmp/slopsentral-pi-trial-01
```

The package path is `/tmp/slopsentral-pi-trial-01/.pi/slopsentral`.
Projection rejects an existing output path.

Start Pi from the repository that needs the extension:

```bash
pi -e /tmp/slopsentral-pi-trial-01/.pi/slopsentral
```

This command loads the package for one invocation.
The default workflow profile is `local-development-default`.
The extension keeps the current model, tools, and thinking level.
Use Pi's existing authentication and model configuration for a model-backed trial.

To select a profile at startup, use the extension flag:

```bash
pi -e /tmp/slopsentral-pi-trial-01/.pi/slopsentral --slopsentral-profile kotlin-type-design
```

## Profiles and commands

| Command | Effect |
| --- | --- |
| `/slopsentral-profile` | Show the current workflow profile and available choices. |
| `/slopsentral-profile kotlin-type-design` | Select Kotlin design guidance and its skill subset. |
| `/slopsentral-profile type-design` | Select broader type-design guidance, including schemas, OpenAPI, and Pkl. |
| `/slopsentral-profile off` | Turn off Slopsentral prompt additions and hooks. |
| `/slopsentral-kotlin-type-design` | Select the named agent profile directly. |
| `/slopsentral-check` | Run the selected completion gates, including when automatic hooks use `OFF`. |

Each source profile also gets a `/slopsentral-<profile-name>` command.
Profile selection persists through custom session entries on the active branch.
Session reload and tree navigation restore that branch's selection.
A selection does not grant authority to push, merge, publish, or deploy.

Existing `WORKFLOW_PROFILE` declarations supply the plugin closures.
The optional `focusSkills` field selects a smaller advertised skill subset within a closure.
`kotlin-type-design` excludes OpenAPI guidance.
`type-design` includes schema, OpenAPI, and Pkl guidance.
Both design profiles use `OFF` for automatic hooks.
`/slopsentral-check` accepts no arguments and reports notices without an automatic continuation.

The subset controls the skills that Pi advertises to the model.
Explicit `/skill:name` commands still reach the complete package skill catalog.
Skills from other packages keep their existing visibility.

## Trial sequence

1. Run `/slopsentral-profile`.
2. Select `/slopsentral-profile kotlin-type-design`.
3. Ask Pi to explain a local domain type without edits.
4. Examine whether its response uses the selected instructions and skills.
5. Select `/slopsentral-profile type-design`.
6. Ask for a schema or OpenAPI design comparison without edits.
7. If the repository has the necessary gate tools, run `/slopsentral-check`.
8. Select `/slopsentral-profile off`.

A command response proves command dispatch, not model compliance.
A model-backed trial needs separate evidence for instruction use, skill choice, and hook behavior.
An absent tool or stale lock is a prerequisite failure, not a successful gate.

## Event adapters

| Source event | Pi event | Purpose |
| --- | --- | --- |
| `SessionStart` | `before_agent_start` | Run deferred session hooks before the first prompt. |
| `UserPromptSubmit` | `input` | Compare source changes and add a hidden context message. |
| `PreToolUse` | `tool_call` | Examine a proposed tool call. |
| `PostToolUse` | `tool_result` | Append scope context to the original tool evidence. |
| Prompt instructions | `before_agent_start` | Add the selected structured prompt section. |
| `Stop` | `agent_before_settle` | Assess final work before Pi settles. |

The adapter runs canonical hook commands with structured argument arrays.
It supplies `PLUGIN_ROOT` for each plugin payload.
It translates supported Codex JSON responses into Pi event results.
Prompt hooks keep the submitted text and images unchanged.
They add context messages without a model request.
Post-tool hooks keep `content`, `structuredContent`, `details`, `isError`, and `usage` from the original result.
Blocked responses keep the review instructions in their `reason`.
It reports bounded failures and does not log environment values.
Hook processes receive the ordinary process environment, including its existing credentials.

The projector rejects unsupported events and adapter commands outside its simple-token grammar.
The adapter does not use shell evaluation.
It limits enforcement to one automatic continuation per user prompt.
Aborted or failed runs do not trigger an enforcement continuation.
Session shutdown cancels hook processes.
The adapter uses the host cancellation signal when Pi supplies one.
Pi does not supply that signal at each lifecycle stage.
Escape cancellation during startup, settlement, and manual gates remains unproved.

| Hook policy | Failure behavior |
| --- | --- |
| `ADVISORY` | Report the failure without an automatic continuation. |
| `ENFORCING` | Block a failed tool-call action or request one continuation for a failed completion gate. |
| `OFF` | Turn off automatic actions. Explicit manual gates remain available. |

A second failed completion gate reports the unresolved failure and ends.
The adapter does not present that result as success.

## Package choices

One package keeps profile commands and event handling under one extension owner.
Per-plugin payloads preserve the scripts and resources that canonical hooks need.
The Pi manifest lists each skill once by its canonical identity.
Generated output remains a consumer of `source/`, never an authored source.

Instructions use a structured prompt section instead of a replacement for Pi's complete system prompt.
Profile state follows the active session branch.
Hook policy comes from the source profile, including `ADVISORY` and `OFF`.
The package declares `@earendil-works/pi-coding-agent` as a peer dependency with the upstream-prescribed `*` range.
The `*` peer range does not prove compatibility with every Pi release.

Agent definitions remain reference material in plugin payloads.
The profile prompt includes their file locations but does not start agents.
Canonical `.mcp.json` files remain reference material in plugin payloads and the provenance lock.
The extension does not connect MCP servers or change tool sets.
Automatic agents and MCP connections remain explicit gaps relative to Codex.
Source profiles do not supply connection consent or ownership for a server lifecycle.

The manual `Release Pi package` workflow publishes a versioned archive and checksum file from `main`.
The archive uses the generated package version from `tools/projection/Pi.pkl`.
It rejects lifecycle scripts, runtime dependencies, symlinks, and local caches.
An existing release causes publication to fail instead of replacement.
Pi releases do not replace the marketplace's latest release designation.
Projection alone does not prove installed-host behavior or improved model decisions.
The handoff report records the checks that ran and the gaps that remain.

## Optional persistent installation

For persistent installation, project into a fresh, durable path outside the checkout.
Install the resulting package path:

```bash
pi install /absolute/output/.pi/slopsentral
```

Pi records a local path without a copy.
Keep that path after installation.
To remove the declaration, use the same path:

```bash
pi remove /absolute/output/.pi/slopsentral
```

The implementation task does not install the package in personal settings.

## Upstream references

These references bind API choices to Pi 1.2.0:

- [Extension lifecycle and API contracts](https://github.com/earendil-works/pi/blob/v1.2.0/packages/coding-agent/docs/extensions.md).
- [Package manifests, local trials, and peer dependencies](https://github.com/earendil-works/pi/blob/v1.2.0/packages/coding-agent/docs/packages.md).
- [Structured prompt sections example](https://github.com/earendil-works/pi/blob/v1.2.0/packages/coding-agent/examples/extensions/prompt-customizer.ts).
- [Profile commands, flags, and status example](https://github.com/earendil-works/pi/blob/v1.2.0/packages/coding-agent/examples/extensions/preset.ts).
- [Extension discovery through the SDK](https://github.com/earendil-works/pi/blob/v1.2.0/packages/coding-agent/examples/sdk/06-extensions.ts).

The shipped preset example supplies useful command patterns.
This adapter uses branch-local entries instead of that example's complete-file state scan.
The current [extension documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md) supplies future API changes.
