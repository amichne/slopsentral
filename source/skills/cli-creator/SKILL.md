---
name: "cli-creator"
description: "Design and scaffold composable CLIs that let agents discover, resolve, read, inspect, and safely mutate external systems through stable commands and JSON output. Use when turning an API, SDK, admin tool, logs source, or web workflow into an agent-usable command-line surface."
---

# CLI Creator

Use this skill when the durable deliverable is a command-line interface an agent
can run from any repository. The CLI should expose small composable operations,
stable JSON, clear help, and safe write boundaries rather than one opaque
"solve everything" command.

## Operating Contract

- Start from the system's real nouns, IDs, and workflows.
- Prefer discover, resolve, read, context, download, inspect, draft, and apply
  commands that compose predictably.
- Emit parseable JSON on stdout for `--json`; send diagnostics and progress to
  stderr.
- When authentication or external setup is required, make `doctor --json` work
  before authentication so setup failures are inspectable.
- Give expected JSON errors a documented, finite code set. A failed operation
  must exit nonzero; an empty successful result must remain distinguishable.
- Redact tokens, cookies, private headers, customer secrets, and unrelated
  payloads.
- Keep writes explicit, scoped, and reviewable. Prefer dry-run or draft commands
  before applying external mutations.

## Workflow

1. Identify the external boundary.
   Name the API, SDK, app, admin tool, database, log source, or workflow the CLI
   will mediate. Record auth, base URLs, stable IDs, pagination, rate limits, and
   read/write risk.

2. Design the command map.
   Use discover for broad containers, resolve when human input maps to stable
   IDs, read for exact objects, and context around known anchors. Omit commands
   the external system cannot support. Add writes after the relevant read or
   validation boundary is proven.

3. Define output contracts.
   For every command Codex will parse, document the JSON success shape, closed
   error codes, exit codes, and any file artifacts written under an explicit
   `--out` path.

4. Scaffold incrementally.
   Implement the smallest path that serves a real workflow: setup diagnosis
   when needed, then discovery, resolution, and exact reads where the system
   offers them. Do not invent a command or identifier to fill a template.

5. Validate with real examples.
   Run help output, the available unauthenticated setup path, one successful
   command, and one expected failure path. For write commands, prove dry-run or
   draft behavior before live mutation when the target supports it.

## Reference Routing

Read [agent-cli-patterns.md](references/agent-cli-patterns.md) when designing
command names, JSON output, pagination, raw escape hatches, or agent-facing help.

## Completion Criteria

- The CLI exposes composable command primitives with stable help.
- JSON output is machine-readable and separated from diagnostics.
- Auth and setup failures are inspectable when those dependencies exist.
- Writes have explicit safety boundaries.
- Validation covers success, failure, and setup paths.
