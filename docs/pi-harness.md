# Pi harness

Install Slopsentral as native Pi skills. The default selection is
`local-development-default`: one `semantic-ratchet` skill, with no instructions,
executable extensions, hooks, custom commands, tools, settings, or model calls.
The [migration reference](/reference/pi-migration) explains the retired runtime.

## One-command setup

Use macOS or Linux with Pi installed on `PATH`, Node.js **22.19 or later**, curl,
and system tar. You need network access to GitHub. This command does not install
Pi or change its model, authentication, defaults, or trust decisions.

Setup requires `pi --version` to succeed within 10 seconds, but accepts any version
output, including local builds. It reports `PI_COMPATIBILITY_UNVERIFIED` and uses
the installed Pi best-effort: executable availability does not prove support for
native local packages, skill discovery, instruction scope, or project trust.
Verify native skill discovery after restarting Pi. The maintainer test dependency
remains pinned to Pi 1.3.0 for reproducibility; it is not a consumer version gate.

Run from the project whose old Slopsentral registration you want to migrate:

```bash
bash -o pipefail -c 'curl -fsSL https://raw.githubusercontent.com/amichne/slopsentral/main/tools/install-pi.sh | sh'
```

The installer selects the current stable native release. It checks GitHub asset
SHA-256 digests, source tags, and candidate and promotion records. It also checks
the successful main validation run and its required steps. It unpacks verified content without
running package scripts. A missing dependency or failed qualification stops setup.
You do not need a checkout, uv, Python, Pkl, an npm build, or a Releases-page visit.

Start a fresh Pi session:

```bash
pi
```

Use Pi's native `/skill:semantic-ratchet` command, or ask for the skill by name.
Skill discovery proves availability; it does not prove model obedience.
No live model request is part of setup qualification.

## Choose scope

The default installs into your personal agent directory, normally
`~/.pi/agent`. Pi's explicit `PI_CODING_AGENT_DIR` is respected.
For current-project scope, run:

```bash
bash -o pipefail -c 'curl -fsSL https://raw.githubusercontent.com/amichne/slopsentral/main/tools/install-pi.sh | sh -s -- --project'
```

The [Pi package reference](https://pi.dev/docs/latest/packages) describes native
local package registration; [skills](https://pi.dev/docs/latest/skills) and
[settings](https://pi.dev/docs/latest/settings) document discovery and scope.
These are vendor contracts, not outside extensions.

Project packages remain subject to Pi's existing project-trust decision.
Setup never grants trust. Run setup again from each other project that still
has a legacy registration. It does not crawl or rewrite unrelated repositories.

A versioned content directory is registered through Pi's native `packages`
setting. Setup removes recognized Slopsentral entries from the personal and
current-project `packages`, `extensions`, and `skills` lists, including old
object filters and local paths. It preserves unrelated entries and settings.
Exact recognized legacy modules in native extension-autoload directories are
removed with recoverable preimages. Unrecognized Slopsentral copies stop setup
with `AMBIGUOUS_LEGACY_EXTENSION`; inspect and move those files out of discovery
before retrying. Session records and old runtime settings are preserved as inert
history; the new package does not read them.

## Repeat and upgrade

Run the same command to upgrade. It installs one qualified version and retains
previous content and configuration preimages. Repeating the current version
returns `CURRENT`, keeps one registration, and preserves the original rollback
record. Changed installed bytes produce `INSTALLED_BYTES_CHANGED` rather than
being overwritten.

To pin a published native version, pass `--version 0.1.N` after `sh -s --`.
Replace `N` with the actual version from setup output. Historical extension
releases cannot satisfy native setup qualification.

## Recovery and removal

From the same project directory and scope, restore the configuration that
preceded the last installation:

```bash
bash -o pipefail -c 'curl -fsSL https://raw.githubusercontent.com/amichne/slopsentral/main/tools/install-pi.sh | sh -s -- --rollback'
```

For project scope, append both `--project --rollback` after `sh -s --`.
Rollback downloads an authenticated installer too; it needs Node and network
access, but does not require Pi or tar. It never executes project-cached code.
Recovery authority is the private transaction under
`~/.pi/slopsentral-recovery`; the copy under `slopsentral-setup/transaction.json`
is for inspection. Preserve these backups if manual recovery is needed.

A pending interrupted transaction reports `RECOVERY_REQUIRED`. Run rollback,
then rerun setup. Dead installer locks with an attributable owner can be
reclaimed; an active or unfamiliar Pi settings lock reports `SETUP_BUSY`.
Stop the other writer before retrying.

If later edits changed a target, rollback reports `CONFIG_CHANGED` and leaves
those edits intact. Compare the private preimages with your current files before
manual recovery. Symlinked configuration scopes are rejected before activation.
Rollback can restore the prior extension registration; use it to undo a failed
migration. To remove a successful installation instead, remove its single
versioned local-path entry from Pi's native package settings, then restart Pi.
Keep backups until you have verified discovery and removal.

## Instructions and custom profiles

Profiles are authoring-time content selections. The default package contains no
instruction policy. A selected profile with instructions emits plain `AGENTS.md`;
setup applies an owned block only in its chosen native scope and preserves
unrelated text. Conflicting native context-file precedence stops installation.

Maintainers can project a supported profile with
`tools/marketplace.py project --harness pi --profile NAME --out FRESH_PATH`.
The profile inventory records selected skills and instruction digests.
Unsupported hook policies and restricted invocation policies fail explicitly;
Pi receives no simulated lifecycle behavior. See
[profiles](/reference/profiles) and [projection](/maintainers/projection).

## Qualification limits

Release checks cover native discovery, instruction scope, absence of legacy
registrations, missing dependencies, changed bytes, repeat installation,
configuration preservation, interruption, and recovery in disposable locations.
Codex and Copilot keep their separate native projections and contracts.
Runtime/model integration and paid inference are not exercised.
The [release reference](/reference/releases) identifies the complete asset set.
