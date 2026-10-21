# Install Slopsentral for Pi

Use Pi 1.3.0, Node.js 22.19 or later, curl, and system tar.
The published launcher selects the latest stable release by default.
It admits release identity and installer bytes before setup.

```sh
bash -o pipefail -c 'curl -fsSL https://github.com/amichne/slopsentral/releases/latest/download/install-pi.sh | sh'
```

Run the command from the project that needs Slopsentral.
For project scope, append `-s -- --project` after `sh`.
For a named release, append `-s -- --version 0.1.N` with its published version.
Use `--rollback` from the same project directory to restore the recorded preimages.

The source entry point at `tools/install-pi.sh` remains available for existing commands.
It delegates to the tested installer from the selected release.
The launcher needs no source checkout or npm installation.

A revert removed the source launcher while the public guide still used its URL.
That source URL returned HTTP 404.
The latest release asset remained available.
The restored entry point preserves release admission and native recovery behavior.
This repair does not change the released package runtime.
