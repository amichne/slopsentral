# Install and manage Slopsentral

The `slopsentral` command uses a locked Python script and uv.
It installs, updates, and removes plugins for one explicitly selected host.
The supported hosts are Codex CLI, GitHub Copilot CLI, Amp, and Pi.

## Install the command

The public bootstrap needs a qualified release that includes the new command assets.
Until that release exists, use this checkout:

```sh
mise exec -- uv run --locked --script tools/slopsentral.py self install
```

After publication, use the release bootstrap:

```sh
bash -o pipefail -c 'curl -fsSL https://github.com/amichne/slopsentral/releases/latest/download/install.sh | sh'
```

The shell downloads uv 0.12.9 only when `uv` is absent from `PATH`.
It downloads the Python script and its adjacent lock, then invokes Python through uv.
The uv installer uses its documented [unmanaged installation](https://docs.astral.sh/uv/reference/installer/#unmanaged-installations) mode.
It preserves shell startup files.
An older installed uv fails the script's minimum-version rule without an implicit replacement.

The command installs at `~/.local/bin/slopsentral`.
Its launcher records absolute paths to uv and an immutable copy of the Python script.
The script needs Python 3.12 or 3.13. uv can download that runtime.
The command does not need a source checkout, npm, or Pkl.

If the command directory is absent from `PATH`, use:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

## Select a host and plugins

Bootstrap installs the command only. Each host operation needs `--host`.
Codex, Copilot, and Amp also need one or more explicit `--plugin` selections.
Pi uses its existing aggregate package.

```sh
slopsentral install --host codex --plugin software-engineering --plugin kotlin-engineering
slopsentral install --host copilot --plugin software-engineering
slopsentral install --host amp --plugin developer-tooling
slopsentral install --host pi
```

| Host | Installation owner | Update source |
| --- | --- | --- |
| Codex CLI | Native marketplace and plugin commands | Configured marketplace, with `harness/codex` for a new registration |
| GitHub Copilot CLI | Native marketplace and plugin commands | Configured marketplace, with the repository default for a new registration |
| Amp | Managed links in the system plugin directory | Stable release archive |
| Pi | Existing native installer and transaction code | Qualified stable release |

Codex and Copilot need their host commands on `PATH`.
Pi needs Node.js and the dependencies described in the [Pi guide](pi-install.md).
Amp loads directory plugins from `$XDG_CONFIG_HOME/amp/plugins` or `~/.config/amp/plugins`.
The command preserves a different existing plugin directory.

A recognized Codex or Copilot marketplace keeps its existing source.
An unknown source with the name `slopsentral` stops the operation.
An existing plugin keeps its enabled state when `install` repeats.
Codex rejects updates for selected disabled plugins because its reinstall command can enable them.
Copilot uses its native update command.

## Update and remove plugins

Use the same explicit selections for updates and removal:

```sh
slopsentral update --host codex --plugin software-engineering
slopsentral update --host copilot --plugin software-engineering
slopsentral update --host amp --plugin developer-tooling
slopsentral update --host pi
slopsentral remove --host codex --plugin software-engineering
slopsentral remove --host copilot --plugin software-engineering
slopsentral remove --host amp --plugin developer-tooling
slopsentral remove --host pi
```

Amp and Pi accept `--version X.Y.Z` for a named stable release.
Codex and Copilot use their configured marketplace channels and reject `--version`.
Each operation uses personal or system scope. Project registrations remain outside this command's scope.

Amp removal deletes managed links and keeps cached package bytes.
Amp compares installed files with the cached release archive before replacement or removal.
Pi removal deletes recognized Slopsentral registrations and its marked instructions from personal scope.
It preserves unrelated settings, project registrations, installed payloads, and private recovery records.
Pi removal uses the same recoverable transaction code as installation.
The existing Pi bootstrap still owns project installation and rollback.

Native commands own their host configuration and caches.
The command stops at the first failed native operation.
Earlier successful operations remain in effect.
Installation does not prove that a new host session loads the plugin or obeys its instructions.

## Update or remove the command

```sh
slopsentral self update
slopsentral self update --version 4.0.7
slopsentral self remove
```

The example version needs a published release with the command assets.
Self-update examines each downloaded asset's origin, size, and GitHub SHA-256 digest.
Amp uses the same digest procedure and rejects archive traversal, links, and special files.
The bootstrap trusts the selected GitHub release before Python starts.
Release digests establish agreement with GitHub metadata, without a separate signature authority.

Command files reside under `$XDG_DATA_HOME/slopsentral/command` or `~/.local/share/slopsentral/command`.
Self-update keeps earlier command copies until removal.
Self-removal examines the recorded file digests before it deletes those copies and the launcher.
Changed files stop replacement or removal. The command preserves those files for inspection.
Self-removal preserves uv and host plugins.

Every completed operation prints one JSON object on stdout.
Failures return a nonzero status. Native diagnostics use stderr.
Argument errors use argparse's exit status 2.
An interrupted command update can leave a lock or an incomplete receipt.
A subsequent operation preserves that state and reports the conflict.
