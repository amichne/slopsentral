# Pi harness

Use Slopsentral in Pi through one package with native commands, instructions, skills, resources, and hooks.
Pi version ranges are unpinned.
The lockfile supplies Pi 1.3.0 for the current evidence.
The `*` ranges do not prove compatibility with future releases.
The [harness overview](agent-marketplaces.md) compares Pi with Codex and GitHub Copilot.

## Install the published package

Use an existing Pi installation with Node.js 22.19 or later.
Open the [latest Pi release](https://github.com/amichne/slopsentral/releases/latest).
Copy its pinned `pi install` command into your terminal.
For project scope, add `--local` after `pi install`.
Choose one installation scope.
Pi loads project packages after project trust.
The package needs no source checkout, Pkl, or npm build.

Each release supplies an install command with its exact version and archive URL.
The [Pi release history](https://github.com/amichne/slopsentral/releases?q=tag%3Api-v) filters earlier versions.
The optional [host launcher](../tools/install-pi.sh) accepts an explicit `SLOPSENTRAL_PI_VERSION` and delegates to Pi.
Its historical default remains `0.1.0`, so use an explicit version for later releases.
Hook actions need their documented tools, including uv for Python hooks.

Pi downloads the archive through npm and keeps it in its managed package directory.
The package has no install scripts or runtime dependencies.
Pi supplies its own host APIs.
Each release includes `SHA256SUMS`, the tested candidate record, and its promotion record.

## Select capabilities

From your project, start a session with the Kotlin design profile:

```bash
pi --slopsentral-profile kotlin-type-design
```

This profile supplies Kotlin instructions and skills with automatic hooks set to `OFF`.
The extension keeps the current model, tools, and thinking level.
Without a startup choice, a new session uses `local-development-default` with `ADVISORY` hooks.
The startup flag supplies the initial choice only.
Saved session entries take precedence during restoration and tree navigation.

Enter `/slopsentral` to open the native settings menu after a run ends.
Select a profile, a save scope, or individual instructions, skills, resources, agents, and hooks.
The menu shows origins, dependencies, effective states, pending reviews, jobs, and recent results.
Search with text and navigate with Pi's configured selection keys.
With the default keys, Enter selects an item and Escape returns to its parent.
Escape exits a picker even when its search contains text.
Ctrl+U clears the search.
Small terminals show an enlargement notice when fewer than eight rows remain.

A profile supplies defaults for independent capabilities.
User, project, and session overrides take precedence in that order.
The `off` profile supplies an empty preset and preserves explicit overrides.
Reset each changed layer to remove those overrides.
A disabled or missing dependency makes its dependent capability unavailable.
The menu and unaffected capabilities remain usable after an optional resource failure.
A failed blocking hook still blocks its affected operation.

| Command | Effect |
| --- | --- |
| `/slopsentral` | Open settings in the TUI or return state in other modes. |
| `/slopsentral state` | Return effective configuration, origins, coverage, errors, jobs, and recent results. |
| `/slopsentral set project JSON` | Replace the project layer with a complete settings object. |
| `/slopsentral set user JSON` | Replace the user layer. |
| `/slopsentral set session JSON` | Replace the layer on the active session branch. |
| `/slopsentral review NOTE` | Record an instruction-scope review and resolve pending obligations. |
| `/slopsentral run hook:NAME` | Run one hook's completion actions with its deadline and dependencies. |
| `/slopsentral cancel KEY` | Request cancellation of the named job from the state output. |
| `/slopsentral-profile NAME` | Select a profile on the active branch. |
| `/slopsentral-NAME` | Select a source profile directly. |
| `/slopsentral-check` | Run completion actions from the selected profile and enabled hooks. |

Settings commands and the menu use the same [configuration owner](../source/hooks/pi/control.ts).
The user file is `slopsentral.json` inside Pi's agent directory.
The project file is `.pi/slopsentral.json` inside the consumer repository.
Session settings use branch-local custom entries.
The package directory keeps no mutable configuration.
Malformed persistent files preserve the last accepted layer within that extension instance and expose an error.
A malformed file without an accepted layer rejects workflow effects until repair.
The settings menu and repair commands remain available.
A rejected command preserves the current state.

Use the [settings schema](../source/schemas/pi/settings.schema.json) for external configuration.
For example, this complete project layer disables one instruction and changes one hook:

```json
{
  "schemaVersion": 1,
  "capabilities": { "instruction:engineering-design": false },
  "hooks": {
    "hook:agents-md-scope": {
      "execution": "foreground",
      "critical": "blocking",
      "output": { "type": "ERRORS" },
      "context": "none",
      "timeoutSeconds": 30
    }
  }
}
```

Stable capability IDs come from `/slopsentral state`.
Local additions support instructions, skills, resources, agents, and hooks through the schema.
The menu supplies an addition wizard for instructions, skills, resources, and hooks.
Relative local paths resolve against the consumer directory and save as absolute paths.
A local skill needs `/reload` before Pi discovers it.
Explicit `/skill:name` commands still reach Pi's discovered skill catalog.
Advertisement controls do not remove those commands.
Agent definitions and resources supply references without automatic agents or MCP connections.
A capability selection grants no publication or tool authority.

In JSON mode, commands return a native `slopsentral-result` message whose `details` contain the typed result.
Read that message from Pi's `message_end` events.
Print mode sends JSON to stderr because Pi owns stdout.
RPC and TUI modes use native notifications.
Pi owns the process exit status, so consumers must inspect the typed result.

## Hook policies

Each hook has an independent execution policy, critical-path policy, output policy, context policy, and optional deadline.
Ordinary hooks inherit foreground execution and the profile's failure policy.
The scope hook defaults to background execution with reports under `ADVISORY`.
An `ENFORCING` profile keeps foreground execution and blocking behavior.

| Policy | Behavior |
| --- | --- |
| `execution: foreground` | Await the hook at its native lifecycle event. |
| `execution: background` | Queue the hook without an await for its subprocess. |
| `critical: report` | Report a failure without a completion block. |
| `critical: blocking` | Reject the affected operation or request one completion continuation. |
| `output: ALWAYS` | Show interpreted output and bounded diagnostics. |
| `output: ERRORS` | Show failed outcomes only. |
| `output: EXCLUDE` | Remove lines that match `pattern`. |
| `output: NEVER` | Suppress ordinary presentation. |
| `context: structured` | Supply interpreted context to a supported model request. |
| `context: none` | Omit hook context from model requests. |

Output objects use the `type` discriminator, such as `{ "type": "NEVER" }`.
`EXCLUDE` also needs a valid JavaScript `pattern`.
Filters act after protocol interpretation and never change success, failure, or blocking behavior.
Context and presentation remain independent.
Blocking completion semantics reject background execution at settings ingress.
Deadlines use integer seconds from 1 through 3600.
Commands use structured argument arrays without shell evaluation.
Hooks receive the ordinary process environment, including its existing credentials.

Background jobs carry the configuration, workspace, session, operation, and mutation revision that admitted them.
Configuration changes, session replacement, branch movement, shutdown, and explicit cancellation reject stale delivery.
Git metadata reads establish branch identity without a Git subprocess.
Unknown branch identity rejects the affected assessment.
The queue admits at most 32 jobs and serializes background work.
Foreground gates do not await that queue.
Cancellation requests TERM, then KILL after 250 milliseconds when necessary.
Cancellation cannot undo external effects that a custom hook already caused.

A failed blocking completion hook requests at most one continuation per prompt.
A second failure remains an unresolved failure.
Background reports never request an automatic continuation.
The recent result list keeps 16 identity-scoped entries.
Old results describe their recorded operation and configuration.
They do not establish the current state.

## Instruction scopes

Pi collects mutation candidates from native `tool_execution_start` events before the effect.
Native `write` and `edit` paths include first-run edits and possible mutations from failed tools.
Collection does not invoke Git or a hook subprocess.
Final settlement starts one assessment for the pending revision by default.
A successful assessment records its revision and keeps the review obligation.
Unchanged subsequent settlements do not repeat advisory assessment.

The assessor uses explicit paths and the existing [instruction-scope rules](agents-md-scope.md).
It reads instruction files without ordinary source payloads, Git baselines, or persistent receipts.
A native instruction edit propagates its current contents immediately through the original tool result.
A deletion propagates a notice to reassess inherited rules.
Other hook context stays outside native tool receipts.

Examine the affected scopes before `/slopsentral review NOTE`.
State the instruction update or source-backed reason for no change in the note.
Disabled hooks, cancellation, failed assessment, and session restoration preserve unresolved evidence.
A completed assessment alone never resolves the review.

Shell commands and unsupported mutation tools lack complete path coverage.
`mutationAdapters` can declare argument fields for custom tools.
The adapter accepts string paths or arrays of string paths from those fields.
An adapter declaration does not prove that the tool reports every effect.
External editor changes lack event coverage.
No filesystem watcher or Git reconciliation fills those gaps.
State exposes these limits and gaps recorded from shell or unsupported tools.

The journal keeps at most 10000 paths and reports overflow as a coverage gap.
Scope guidance lists at most 60 paths or descendants and limits context to 24 KiB.
Large instruction files need a separate read.
The [implementation evidence](pi-implementation-evidence.md) separates component, native-host, PTY, installed-host, and process-count proof.

## Update or remove the package

The install command selects one Slopsentral release.
To change releases, install the named package with the new release URL.
Keep the same personal or project installation scope.
`pi update --extensions` does not discover newer GitHub release URLs.
Use `pi list` to examine package declarations.

To remove a personal declaration, run:

```bash
pi remove npm:slopsentral-pi
```

To remove a project declaration, run:

```bash
pi remove --local npm:slopsentral-pi
```

## Package ownership

[Pi.pkl](../tools/projection/Pi.pkl) composes profiles and capabilities from canonical source references.
It projects only the scope hook's settlement adapter into Pi.
Codex and Copilot keep their own event contracts.
The package copies runtime modules and schemas from their authored owners.
Generated output and installed caches remain consumers.
[package_pi.py](../tools/package_pi.py) admits the complete payload before archive creation.
Both Pi peer dependencies use `*`.
The development dependencies also use `*`, while the lockfile preserves reproducible test inputs.
Instructions use a structured prompt section within Pi's existing system prompt.
Slopsentral does not infer task intent from prompt keywords.

## Automatic releases

`Validate Source` runs the full source suite before its Pi candidate job.
That job examines every Pi contract, packages one archive, and installs that archive through Pi's native CLI.
Only a successful installation permits the candidate record.
The version is `0.1.<Validate Source run number>`.
The archive manifest receives that version without a change to the authored package or projected tree.
The packager rejects lifecycle scripts, runtime dependencies, symlinks, and local caches.

After a merge, the main run can reuse the successful PR candidate.
Reuse needs a merged PR from this repository, the exact producer identity, and complete Git-tree equality.
Missing or expired candidates cause a fresh main package and installation.
A different merge tree also causes a fresh main candidate.
A corrupt candidate or foreign producer stops the operation.
The retained artifacts expire after 30 days.

`Release Pi package` starts automatically after a successful `Validate Source` push run on `main`.
It admits that main run, the original producer, both source trees, and the archive digest and version.
The workflow uploads the same archive bytes without another package build or installation.
PR jobs receive read-only permissions.
The publisher treats candidate files as data and never extracts the tar archive or starts its scripts.
It admits only the three expected, bounded ZIP members before it copies the artifact files.

Each `pi-v<version>` release contains the archive, `SHA256SUMS`, `candidate.json`, and `promotion.json`.
The candidate record identifies the tested source commit, tree, producer run, run attempt, version, and archive digest.
The promotion record binds that candidate to the successful main run and merged commit.
The tag targets the merged commit.
The [provenance schemas](../source/schemas/pi/) define both record shapes.
Existing tags or releases cause publication to fail instead of replacement.
Each new Pi release receives GitHub's Latest designation.
The repository has one Latest release across all components.
Earlier marketplace and component releases keep their existing tags and download URLs.

For a manual publication retry, select `Release Pi package` on `main` and supply the successful main run's `run_id`.
The workflow uses that run's exact commit, even after main advances.
A failed run, wrong workflow, non-main branch, missing artifact, or changed producer attempt stops publication.
If a failed publication leaves a tag, examine its source and release state before a manual recovery.
Local tests exercise these admission rules and archive identity.
The first [automatic release](https://github.com/amichne/slopsentral/releases/tag/pi-v0.1.212) used this path.
Its public archive matched the tested candidate and installed through Pi's native package manager.
That evidence applies to the named release.

## Local trial from source

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
pi -e /tmp/slopsentral-pi-trial-01/.pi/slopsentral --slopsentral-profile kotlin-type-design
```

This command loads the package for one invocation without a saved package declaration.

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

The published archive remains the normal installation path for users.

## Upstream references

These references bind the current evidence to Pi 1.3.0:

- [Extension lifecycle and API contracts](https://github.com/earendil-works/pi/blob/71023aec1546d6d677a65669c5665c0927ce0dd0/packages/coding-agent/docs/extensions.md).
- [Package manifests, local trials, and peer dependencies](https://github.com/earendil-works/pi/blob/71023aec1546d6d677a65669c5665c0927ce0dd0/packages/coding-agent/docs/packages.md).
- [Structured prompt sections example](https://github.com/earendil-works/pi/blob/71023aec1546d6d677a65669c5665c0927ce0dd0/packages/coding-agent/examples/extensions/prompt-customizer.ts).
- [Profile commands, flags, and status example](https://github.com/earendil-works/pi/blob/71023aec1546d6d677a65669c5665c0927ce0dd0/packages/coding-agent/examples/extensions/preset.ts).
- [Extension discovery through the SDK](https://github.com/earendil-works/pi/blob/71023aec1546d6d677a65669c5665c0927ce0dd0/packages/coding-agent/examples/sdk/06-extensions.ts).

The shipped preset example supplies useful command patterns.
This adapter uses branch-local entries instead of that example's complete-file state scan.
The current [extension documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md) supplies future API changes.
