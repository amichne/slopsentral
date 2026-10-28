# Install Slopsentral for Pi

Use macOS or Linux with Pi on `PATH`, Node.js 22.19 or later, curl, and system tar.
The launcher selects the latest stable release and verifies its installer bytes.

```sh
bash -o pipefail -c 'curl -fsSL https://github.com/amichne/slopsentral/releases/latest/download/install-pi.sh | sh'
```

Run from the project whose old Slopsentral registration you want to migrate.
The source entry point at `tools/install-pi.sh` remains available for existing commands.
No checkout, npm installation, Python, or Pkl is needed by consumers.

## Download failures

The launcher and installer use curl for every HTTPS request.
Both stages use curl certificate trust and proxy settings.
An approved certificate bundle can be selected with `CURL_CA_BUNDLE`.
TLS certificate checks remain enabled, and redirects must use HTTPS.

Older installers used Node `fetch` after the first curl download.
That change of client can produce `fetch failed` when Node lacks the configured certificate trust or proxy route.
The new installer reports the host and curl exit code or HTTP status.
A matching error alone does not establish the network cause.

If GitHub returns an API rate-limit error, supply `GH_TOKEN` or `GITHUB_TOKEN` to the shell that runs setup.
The installer sends the token only to `https://api.github.com`, through curl input rather than process arguments.
Release asset downloads do not receive that authorization header.

## Checkout dependency failures

Consumer installation does not need `npm install` or a source checkout.
`ERR_MODULE_NOT_FOUND` for `ajv` in `tools/resource-contract.mjs` means the checkout lacks its schema dependencies.
For source projection alone, install the locked production dependencies:

```sh
npm ci --omit=dev --ignore-scripts
```

The full maintainer suite needs `npm ci --ignore-scripts`, including the Codex SDK and promptfoo.
An npm `E403` from a corporate registry means that registry denied the package request.
A fresh checkout cannot fix that denial.
Request package access through the registry administrator when the full suite is necessary.
Peer-dependency and deprecation notices do not explain that HTTP rejection.

## Installed Pi compatibility

Setup requires `pi --version` to succeed within 10 seconds, but accepts any version
output, including local builds. `PI_COMPATIBILITY_UNVERIFIED` is a best-effort
warning, not a version rejection. Executability does not prove support for local
packages, native skill discovery, instruction scope, or project trust.

Restart Pi after setup. The package exposes all five plugins through native Pi resources:

| Plugin | Native resources |
| --- | --- |
| Software Engineering | Eight skills, shared instructions, and instruction-scope review |
| Kotlin Engineering | Six skills |
| IntelliJ Plugin Development | Three skills |
| Repository Knowledge | Four skills, registered knowledge context, and drift reports |
| Developer Tooling | Ten skills and two review prompts |

The aggregate registers 30 unique skills. Both Software Engineering and Developer Tooling reference the same `python-tooling` skill.
Use `/skill:semantic-ratchet`, `/skill:kotlin-review`, or another native skill command.
Use `/slopsentral-schema-type-enforcer` and `/slopsentral-openapi-contract-rater` for the review prompts.
These prompts use the current Pi session and model. They do not start separate agents.

Each projected plugin also contains its own `package.json` for native local-package use.
Install either the aggregate or selected plugin directories. Native Pi package filters control resource selection.
Avoid simultaneous registrations of the aggregate and its plugin directories because skill names overlap.

The hook adapters use Pi's `before_agent_start`, `tool_call`, and `agent_before_settle` events.
The shared instructions enter the system prompt for each request.
Registered knowledge enters the session context. Drift reports remain advisory.
An instruction-scope rejection requests one repair turn. A repeated rejection stays visible and does not cause an automatic loop.
The adapters preserve messages and continuation requests from earlier extensions.
Instruction review uses Pi's global instruction directory and stores its receipts there.
The emitted review command preserves that scope through `SLOPSENTRAL_SCOPE_HOME`.

Hook execution needs `uv` and each canonical script's dependencies on `PATH`.
Setup does not install those dependencies. Missing dependencies produce explicit hook failures.
A context-hook failure blocks tool calls until a subsequent request succeeds.
Hook processes obey time limits, output limits, and cancellation.

Use `/hooks` in interactive Pi to turn individual Slopsentral hooks on or off.
Press Enter or Space to change the selected hook.
Press Esc to return to the session.

The selected row shows its canonical events, Pi events, script commands, and script root.
One switch controls every event of that hook. Other plugins keep their own choices.

Choices take effect at the next request or settlement. A current turn keeps its admission result.
Choices persist across sessions in `slopsentral-hooks.json` under Pi's global instruction directory.

Hooks default to on. Disabled hooks start no script processes.
The adapters refresh cached session context after a choice changes.

Invalid saved choices block hook effects and produce an error. The menu preserves an invalid file.
The switches control Slopsentral hooks. Other extensions and shared instructions keep their existing behavior.

Pi retains its native project-trust decision. The maintainer dependency pins Pi 1.3.0 for executable evidence.
Older hosts can lack the native events that the adapters need.

## Scope, updates, and recovery

Personal scope is the default, using `~/.pi/agent` or `PI_CODING_AGENT_DIR`.
For project scope, append `-s -- --project` after `sh` in the command above.
For a named native release, append `-s -- --version 4.0.1` (or another published `X.Y.Z` version).
Run the same command to update. Repeating the current version returns `CURRENT`.

Setup verifies the release tag, asset digests, source identity, and successful
main validation run before changing configuration. It migrates recognized
Slopsentral registrations in personal and current-project scope, preserves
unrelated settings, and records private recoverable preimages. Ambiguous legacy
extensions and changed installed bytes stop setup rather than being overwritten.

Use `--rollback` from the same project directory and scope to restore the recorded
preimages; project recovery needs both `--project --rollback`. Rollback still
verifies the release, but needs neither Pi nor tar. It never executes project-cached
recovery code. Later edits produce `CONFIG_CHANGED` and are preserved.

## Maintainers

`tools/projection/Pi.pkl` defines the native package shape for every catalog plugin.
The projector uses each validated plugin composition and deduplicates shared skill registrations:

```sh
node tools/project-marketplaces.mjs --source . --harness pi --out /tmp/slopsentral-pi-fresh
npm run check:pi
node --test tools/tests/pi-*.test.mjs
```

Use a fresh output path and the checksum-verified Pkl 0.32.0 runtime. Pi projection
supports native plugin packages. It does not emulate workflow profiles.

`Validate Source` tests native discovery, archive installation, setup, and recovery
before retaining the Pi archive and installer. `Release Slopsentral` admits only a
successful main version increment, verifies retained bytes, and checks actual
release downloads before making the shared release current. It does not rebuild
packages or replace old assets. Codex, Copilot, Amp, and Pi artifacts share the
same release version; provider-branch publication remains owned by `Publish Harnesses`.
See [Release Please and required App setup](releases.md). Native discovery, hooks, archive installation, and recovery have executable tests.
The tests do not make model requests.

Changes reach consumers only after a new qualified release is published. Existing
immutable releases can still carry their historical Pi version requirement.
