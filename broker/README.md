# Broker

This package is a strict TypeScript proxy for the runtime-qualified Codex App Server protocol. It
owns the normal local App Server control socket, supervises one private upstream
`codex app-server` process, injects a generation-pinned dynamic-tool catalog, and routes typed
calls to independent Gradle and Kast providers. Provider execution remains lazy; installed
contracts are qualified before a catalog generation is published.

The broker does not replace, wrap, alias, or shadow `codex`. Start the broker, then use the normal
managed `codex` command. If another process already owns either socket, startup fails closed.

## Qualified contracts

- Codex: any installed CLI that emits the required experimental App Server schemas
- Kast: any installed CLI whose live `--schema` document contains the supported
  `serverProjection` contract
- Node.js: 22 or newer

At startup the broker asks the configured executable for its version and runs
`codex app-server generate-json-schema --experimental --out <temporary-directory>`. It bounds and
digests the complete output, locates the ten App Server messages the broker owns, and compiles
their validators before launching that same executable. Generated schemas remain ephemeral. A CLI
that lacks the command or any required contract fails closed as `CodexProtocolIncompatible`.
Before admitting each new client, the broker probes that executable's version. When the version
changes while the broker is running, it generates and validates the replacement contract before
starting a replacement generation and binds that client's protocol adapter to the replacement
validators. Existing clients drain on their original generation, and concurrent new clients share
the same transition. An incompatible replacement is rejected without weakening the active
contract or requiring a manual broker restart.

Before constructing the catalog, the broker runs the exact configured Kast executable's
`--version` and `--schema` commands. It bounds and decodes the capability document, admits the
installed `serverProjection` JSON Schema subset, and obtains tool names, descriptions, input and
output schemas, loading policy, operation identities, command tokens, and field-to-option bindings
from that document. It records the complete canonical digest. Before the first Kast invocation,
the lazy runtime qualifies the same executable again and rejects any version or contract drift as
`KAST_CONTRACT_CHANGED`. Incomplete, malformed, unmapped, duplicated, or unsupported projections
fail closed.

Before each new downstream connection is initialized, the broker reloads all provider schema
registrations into a candidate generation. It validates and digests the complete candidate before
one atomic swap. Existing connections keep leases on their original brokers and drain normally;
new connections receive the replacement. An unchanged digest is a no-op, and an invalid or
unavailable replacement rejects that new connection without weakening the active generation.
Sending `SIGHUP` to the serving broker stages the same atomic reload immediately; no process
restart or socket replacement is required.

## Tools

The deterministic catalog is available after contract qualification without starting either
provider runtime:

- `gradle.inspect`, `gradle.tasks`, and `gradle.dependencies` execute the target repository's exact
  executable `gradlew` path without a shell.
- The currently installed Kast projection advertises `kast.symbol_discover`,
  `kast.symbol_resolve`, and `kast.traversal_run`. Those identities and shapes are not owned by the
  broker; another compatible installed projection changes the catalog dynamically.

All current tools are read-only. Kast's admitted JSON Schemas are refined into executable TypeBox
schemas before entering the catalog. Model arguments cross that exact decoder before provider
startup or invocation. Unknown properties, invalid scalar values, incomplete variants, unsupported
CLI bindings, and invalid constraints are finite failures.

`defineProviderSchema` is the common tool-definition boundary. One schema instance owns the
namespace, version, tool names, descriptions, loading policy, input schemas, output schemas, and
provider-specific operation metadata. `registerProviderSchema` derives catalog registration,
input/output decoding, and dispatch from that instance. The provider supplies one explicit runtime
capability for startup, invocation, and presentation because a data schema describes an operation
but does not grant process or I/O authority. Kast uses this path directly, so changing its admitted
server projection does not require a parallel broker tool list.

The complete provider schema has its own SHA-256 identity, including output schemas and
provider-specific operation metadata. The catalog digest includes those identities; a semantic
schema change therefore creates a new generation even when its model-facing input shape is
unchanged.

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
  the default is `kast`. Use an absolute version-scoped path when catalog identity must not follow a
  mutable `PATH` or installer `current` link.
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
string is admitted when its generated contract is compatible. Generation tests prove atomic
replacement, failed-reload isolation, and old-generation draining. A Kast fixture changes both a
tool name and its input field and proves the catalog and resulting CLI invocation follow only that
selected executable's projection.

The canonical gate and installed-upstream acceptance select a bounded schema-emitting Kast fixture
so package and Codex supervision proofs do not depend on runner machine state. They never substitute
for the installed-system acceptance below, which selects and executes the real installed Kast path.

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
