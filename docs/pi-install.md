# Install Slopsentral for Pi

Use the Pi bootstrap for native aggregate installation, project scope, and rollback.
For personal installation through the shared command, use the [command guide](cli-install.md).
Both paths use the same native setup owner.

Consumers need macOS or Linux, Pi on `PATH`, Node.js 22.19 or later, curl, and system tar.
The Pi bootstrap needs no checkout, npm installation, system Python, uv, or Pkl.
Setup downloads its private hook runtime before activating configuration.

```sh
bash -o pipefail -c 'curl -fsSL https://github.com/amichne/slopsentral/releases/latest/download/install-pi.sh | sh'
```

Run it from the project whose old Slopsentral registration needs migration.
The source entry point remains `tools/install-pi.sh`.
Setup admits the release tag, asset digests, source identity, and successful main validation before configuration writes.

## Download failures

The launcher and installer use curl for HTTPS downloads.
They use curl certificate trust and proxy settings.
Use `CURL_CA_BUNDLE` for an approved certificate bundle.
TLS checks remain enabled. Redirects must use HTTPS.

For a GitHub API rate-limit error, supply `GH_TOKEN` or `GITHUB_TOKEN` in the setup shell.
The installer sends it only to `https://api.github.com` through curl input.
Release downloads receive no authorization header.

Older installers used Node `fetch` after curl.
A `fetch failed` error can reflect different certificate trust or proxy routes.
The current installer reports the host and curl exit code or HTTP status.
An error string alone does not establish its network cause.

## Checkout dependency failures

Consumer setup does not need checkout dependencies.
For maintainer projection, `ERR_MODULE_NOT_FOUND` for `ajv` means the checkout lacks its schema dependencies.
Install locked production dependencies for projection alone:

```sh
npm ci --omit=dev --ignore-scripts
```

The full maintainer suite needs `npm ci --ignore-scripts`.
An npm `E403` means the registry denied the request.
Use the registry administrator's access process when that dependency set is necessary.
A fresh checkout or a peer-dependency notice does not explain the denial.

## Installed Pi compatibility

Setup needs `pi --version` to succeed within 10 seconds.
It accepts local version strings.
`PI_COMPATIBILITY_UNVERIFIED` reports a best-effort warning rather than a version rejection.
Executability alone cannot establish native discovery or event support.
Restart Pi after installation.

The aggregate exposes the five catalog plugins through native resources.
Shared skills register once. Each plugin also has a native local-package manifest.
Install the aggregate or selected plugin directories, without duplicate registration.
Use native commands such as `/skill:semantic-ratchet` or `/skill:kotlin-review`.
The two `/slopsentral-*` review prompts use the current session and model.
They do not start separate agents.

## Turn hooks on or off

Slopsentral hooks start off in Pi, including after an upgrade from the old settings format.
Pi still loads native project instructions and the package's shared instructions, skills, and review prompts.

1. Enter `/hooks` in interactive Pi.
2. Select a hook. Press Enter or Space to switch it between `on` and `off`.
3. Press Esc to return.

Each row lists the events and commands for that hook. Turn on only the hooks you want.

| Hook | When on |
| --- | --- |
| `software-engineering/agents-md-scope` | Scans Git paths and fingerprints instruction files before a request and at the end of a completed turn. A pending review can add a message and start one repair turn. |
| `repository-knowledge/code-knowledge-drift` | Examines drift in registered repository knowledge at the end of a completed turn. The report can appear after the answer. |
| `repository-knowledge/knowledge-overlay` | Adds context from registered repository knowledge to the session. |

Choices apply at the next request or turn end. An admitted turn keeps its current result.
Choices persist across Pi sessions in `slopsentral-hooks.json` in Pi's global instruction directory.
The old format stored opt-outs only. Use `/hooks` to turn on a hook after an upgrade.
The menu saves the new format on the first change.
Invalid choices stop hook effects. The menu reports the file path for repair.

## Hook runtime

The bootstrap provisions CPython 3.12.14 under `~/.pi/slopsentral-hook-runtime`.
Personal and project packages share that private runtime; project files cannot select its executable.
It verifies a pinned uv 0.12.9 archive, uses that setup tool to install Python, and removes the tool afterward.
Setup needs network access for these downloads. It keeps TLS verification enabled.
The runtime targets macOS and Linux with glibc on arm64 and x64.

Managed hooks invoke the private interpreter directly, with isolated imports and bytecode writes disabled.
Hook execution needs neither network access nor system Python or uv.
Emitted status and review commands keep the private interpreter and instruction scope, including when status returns the next review command.
The runtime receipt binds the platform, relative executable path, and interpreter digest.
Repeat setup verifies the interpreter before reporting it ready.
Setup writes no host settings when runtime preparation fails.

Direct native package installation bypasses the bootstrap and retains the external uv requirement.
The private runtime supports the current hooks, whose declared dependency lists are empty.
A future hook with third-party dependencies requires an explicit runtime update and otherwise reports `HOOK_RUNTIME_UNSUPPORTED_DEPENDENCIES`.
Missing or changed runtime files produce explicit failures.
A context-hook failure blocks tool calls until a later request succeeds.
Processes obey time limits, output limits, and cancellation.

## Scope, updates, and recovery

Personal scope uses `~/.pi/agent` or `PI_CODING_AGENT_DIR`.
For project scope, append `-s -- --project` after `sh` in the bootstrap command.
For a named release, append `-s -- --version X.Y.Z`.
Run the same command for updates. An identical version returns `CURRENT`.

Setup migrates recognized personal and current-project registrations.
It preserves unrelated settings and saves private preimages.
Ambiguous legacy extensions and edited installed bytes stop setup.

Use `--rollback` from the same project and scope to restore recorded preimages.
Project recovery needs both `--project --rollback`.
Rollback still admits the release, but needs neither Pi nor tar.
It never runs project-cached recovery code.
If you return to a release that expects the old hook settings format, move the new settings file aside before you restart Pi.
Later edits return `CONFIG_CHANGED` and remain intact.

## Maintainers

[Pi projection](../tools/projection/Pi.pkl) owns package shapes.
[Native setup](../tools/setup-pi.mts) owns migration, removal, and recovery.
The [adapter](../source/hooks/pi/adapter.ts) owns event translation.
Use a fresh external output with pinned Pkl 0.32.0:

```sh
node tools/project-marketplaces.mjs --source . --harness pi --out /tmp/slopsentral-pi-fresh
npm run check:pi
node --test tools/tests/pi-*.test.mjs
```

The maintainer dependency pins Pi 1.3.0 for executable evidence.
[Archive installation](../tools/tests/pi-install.test.mjs), [setup](../tools/tests/pi-setup.test.mjs), and
[hook tests](../tools/tests/pi-hooks.test.mjs) exercise those mechanisms without model requests.
They do not establish compatibility with every Pi version.

The [release workflow](releases.md) promotes tested bytes without a rebuild.
A checkout edit reaches consumers only through a new qualified release.
Older immutable releases keep their historical requirements.
The [installation concept](../openwiki/integrations/installation.md) connects setup to its source and release owners.
