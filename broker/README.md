# Broker

This package is a strict TypeScript proxy for the runtime-qualified Codex App Server protocol. It
owns the normal local App Server control socket, supervises one private upstream
`codex app-server` process, injects one deterministic dynamic-tool catalog, and routes typed calls
to independent, lazy Gradle and Kast providers.

The broker does not replace, wrap, alias, or shadow `codex`. Start the broker, then use the normal
managed `codex` command. If another process already owns either socket, startup fails closed.

## Qualified contracts

- Codex: any installed CLI that emits the required experimental App Server schemas
- Kast: any installed CLI whose live capability schema proves the broker-owned operations
- Node.js: 22 or newer

At startup the broker asks the configured executable for its version and runs
`codex app-server generate-json-schema --experimental --out <temporary-directory>`. It bounds and
digests the complete output, locates the ten App Server messages the broker owns, and compiles
their validators before launching that same executable. Generated schemas remain ephemeral. A CLI
that lacks the command or any required contract fails closed as `CodexProtocolIncompatible`.

Kast remains lazy. Before its first semantic call, the broker runs the configured executable's
`--version` and `--schema` commands, decodes the bounded capability document, proves schema-version
consistency plus the three required operation and CLI projections, and records a canonical digest.
Compatible CLI and schema versions are accepted; incomplete or malformed capabilities fail closed.

## Tools

The static catalog is available without starting either provider:

- `gradle.inspect`, `gradle.tasks`, and `gradle.dependencies` execute the target repository's exact
  executable `gradlew` path without a shell.
- `kast.symbol_discover`, `kast.symbol_resolve`, and `kast.traversal_run` preserve Kast's bounded,
  discriminated semantic contracts.

All MVP tools are read-only. Model arguments cross one strict TypeBox decoder before provider
startup or invocation. Unknown properties, invalid scalar values, incomplete variants, and invalid
constraints are finite `InvalidArguments` failures.

## Run

```shell
npm ci
npm run build
node dist/broker.mjs catalog
node dist/broker.mjs qualify
node dist/broker.mjs qualify kast
node dist/broker.mjs serve
```

In another terminal, invoke Codex normally:

```shell
codex
```

The default public socket is
`$CODEX_HOME/app-server-control/app-server-control.sock` (or `~/.codex/...`). The private upstream
socket and persisted thread-to-catalog bindings live under
`$CODEX_HOME/broker/`. A resumed or forked thread is rejected when its persisted
catalog digest cannot prove compatibility.

Configuration is sourced once at the runtime boundary:

- `CODEX_HOME` selects broker state and the well-known socket root.
- `CODEX_EXECUTABLE` selects the exact executable whose generated contract is qualified and whose
  App Server is launched.
- `KAST_EXECUTABLE` selects the exact Kast executable whose live capability schema is qualified;
  the default is `kast`.
- `BROKER_PROVIDER_CWD` selects the qualification workspace; the default is the broker's startup
  directory.

Connection count, per-connection and per-provider concurrency, startup and invocation timeouts,
message sizes, tool argument/result sizes, descriptor count, and catalog size all have finite
validated defaults in `src/runtime/config.ts`.

## Verify

```shell
npm run check
npm run acceptance:upstream
npm run acceptance:installed
```

`npm run check` is the canonical repository gate: formatting, strict types, architecture rules,
runtime protocol qualification, unit/integration tests, and the bundled executable. The
installed-upstream acceptance generates the installed Codex CLI's exact contract, starts one App
Server process behind the public broker socket, completes initialization, and proves providers
remain absent before their first calls. Unit tests separately prove that an arbitrary version
string is admitted when its generated contract is compatible. The same proof covers arbitrary
Kast CLI and schema versions whose capability manifests retain the broker-owned operations.

The installed-system acceptance requires `gradle`, the qualified `kast`, and a compatible `codex`
on `PATH`. It creates and removes a disposable consumer Gradle repository outside this package,
executes real Gradle and Kast adapters through the same running broker, qualifies decode,
cancellation, resume, and fork behavior, and records
`dist/installed-system-acceptance-receipt.json`. The receipt's `accepted` value is derived from its
proofs. The harness deliberately performs no model call and consumes no inference quota.

## Install a release

The release archive contains one bundled ESM executable and requires Node.js 22 or newer:

```shell
curl -fsSL \
  https://raw.githubusercontent.com/amichne/slopsentral/main/broker/install.sh \
  | bash
```

The installer verifies the published SHA-256 checksum and installs
`~/.local/bin/broker`. It does not launch or modify `codex`.
