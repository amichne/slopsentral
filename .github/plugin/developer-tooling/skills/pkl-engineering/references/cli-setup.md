# Pkl CLI Setup

Use this reference to establish a reproducible local development loop. These
commands are routes to first-party surfaces, not a substitute for checking the
versioned documentation that matches the installed Pkl release.

## CLI installation

Use an exact native Pkl release for the host OS and architecture.
Download its binary from the [official releases](https://github.com/apple/pkl/releases),
verify the published checksum, and run `pkl --version` from that explicit path.
The repository's setup helper already pins and verifies its required runtime.
Keep an existing runtime when it satisfies the project's pinned contract.

Source: [official Pkl CLI reference](https://pkl-lang.org/main/current/pkl-cli/index.html).
Do not add a package manager or change shell startup to install this dependency.

## Integration limits

The retained skill uses the Pkl CLI directly.
Editor extensions and LSP servers are not installation dependencies.
Keep the user's existing editor and settings unchanged.
A CLI result proves configuration behavior, not editor discovery or diagnostics.

## Repository hook setup

The source graph contains optional format, evaluation, and test hook primitives.
Developer Tooling does not install those hooks.
Only a user-requested local composition can select them.
For that explicit composition, list one evaluation entry module per line:

```text
# .intelligence/pkl-entrypoints
config/dev.pkl
config/prod.pkl
```

Only modules that can be evaluated directly belong here. Templates, abstract
modules, and library-only modules should be exercised through their consumers
or tests instead of being guessed by a hook.
