# Install Slopsentral for Pi

Use macOS or Linux with Pi on `PATH`, Node.js 22.19 or later, curl, and system tar.
The launcher selects the latest stable release and verifies its installer bytes.

```sh
bash -o pipefail -c 'curl -fsSL https://github.com/amichne/slopsentral/releases/latest/download/install-pi.sh | sh'
```

Run from the project whose old Slopsentral registration you want to migrate.
The source entry point at `tools/install-pi.sh` remains available for existing commands.
No checkout, npm installation, Python, or Pkl is needed by consumers.

## Installed Pi compatibility

Setup requires `pi --version` to succeed within 10 seconds, but accepts any version
output, including local builds. `PI_COMPATIBILITY_UNVERIFIED` is a best-effort
warning, not a version rejection. Executability does not prove support for local
packages, native skill discovery, instruction scope, or project trust.

Restart Pi and verify `/skill:semantic-ratchet` after setup. The package contains
only the canonical `semantic-ratchet` skill and no extensions, hooks, commands,
model calls, or instruction policy. Pi's project-trust decision is unchanged.
The maintainer Pi dependency is pinned for reproducible tests, not consumer admission.

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

`tools/projection/Pi.pkl` defines the native default package shape. The existing
projector selects `semantic-ratchet` from the validated software-engineering
composition without changing authored plugins or workflow profiles:

```sh
node tools/project-marketplaces.mjs --source . --harness pi --out /tmp/slopsentral-pi-fresh
npm run check:pi
node --test tools/tests/pi-*.test.mjs
```

Use a fresh output path and the checksum-verified Pkl 0.32.0 runtime. Pi projection
supports only this native default; it does not emulate arbitrary workflow profiles.

`Validate Source` tests native discovery, archive installation, setup, and recovery
before retaining the Pi archive and installer. `Release Slopsentral` admits only a
successful main version increment, verifies retained bytes, and checks actual
release downloads before making the shared release current. It does not rebuild
packages or replace old assets. Codex, Copilot, Amp, and Pi artifacts share the
same release version; provider-branch publication remains owned by `Publish Harnesses`.
See [Release Please and required App setup](releases.md). Runtime/model integration
and paid inference are not exercised.

Changes reach consumers only after a new qualified release is published. Existing
immutable releases can still carry their historical Pi version requirement.
