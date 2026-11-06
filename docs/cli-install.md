# How to install

Install the `slopsentral` command, then select your host and plugins.
Consumers need no Slopsentral checkout, npm, or Pkl.

## Prerequisites

Use macOS or Linux for the shell bootstrap.
The command needs uv and Python 3.12 or 3.13.
The bootstrap installs pinned uv when it is absent. uv can download Python.
If an existing uv is too old, update it before installation.

Install your coding host first.
Codex and Copilot need their CLI commands on `PATH`.
Pi needs its command, Node.js 22.19 or later, curl, and system tar.

## Install

Run the bootstrap from a release that includes the command assets:

```sh
bash -o pipefail -c 'curl -fsSL https://github.com/amichne/slopsentral/releases/latest/download/install.sh | sh'
```

If `~/.local/bin` is absent from `PATH`, add it:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

Start guided setup:

```sh
slopsentral setup
```

Choose the bulk action and hosts, then accept the action summary.
For selected plugins, use an explicit command instead:

```sh
slopsentral install --host codex --plugin software-engineering --plugin kotlin-engineering
slopsentral install --host copilot --plugin software-engineering
slopsentral install --host amp --plugin developer-tooling
slopsentral install --host pi
```

[What you get](../README.md) explains the five choices.
Codex, Copilot, and Amp also accept `--all` instead of `--plugin`.
Pi installs the aggregate package and rejects `--plugin`.
Restart Pi after installation.

## Update or remove

Use the same host and plugin selection:

```sh
slopsentral update --host codex --plugin software-engineering
slopsentral remove --host codex --plugin software-engineering
slopsentral self update
slopsentral self remove
```

Replace `codex` with `copilot` or `amp` for those hosts.
For Pi, use `slopsentral update --host pi` or `slopsentral remove --host pi`.
Self-removal preserves installed host plugins.

## Special cases

Use the [command reference](cli-reference.md) for automation, versions, selector controls, failures, and the Kotlin layout detector.
Use [Pi setup and recovery](pi-install.md) for project scope, direct bootstrap, and rollback.
Use [checkout setup](developers/contribute.md#prepare-a-checkout) to install from source.

The command uses native Codex and Copilot operations, managed Amp links, and the native Pi installer.
Installation does not prove that a host discovers or uses the installed instructions.
