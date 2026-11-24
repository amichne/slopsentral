---
name: "cli-creator"
description: "Create or extend composable CLIs, personal utilities, and terminal interfaces. Use for command contracts, JSON output, explicit writes, completion, teach mode, or terminal behavior."
---

# CLI Creator

Give each command one useful operation and an explicit result.
Preserve the project's language and existing command contracts.

## Implementation Baseline

Use Kotlin and the existing toolchain for Kotlin applications.
For Python automation, use `python-tooling` and use strict
Pyright, Ruff, and pytest. Use PEP 723 headers and adjacent locks for portable
scripts. Commit dependency locks and set `tool.uv.no-build = true`.
Parse external inputs once into constrained values.
Keep decisions pure and file, process, network, and terminal effects in explicit adapters.
Give public CLI commands executable names without file extensions and a
distribution path on `PATH`.
Use argument arrays for processes.
Keep shell only where the parent shell owns state or a host needs a launcher.

## Workflow

1. Inspect the command owner, real callers, installation source, environments,
   and assertions. Extend a suitable command; add one only when no current
   interface meets the requested contract.
2. Name the primary task, input contract, effects, finite failures, and protected invariant.
3. Design the smallest supported composable operation.
4. Define stdout, stderr, exit codes, and empty results before implementation;
   pagination and output schemas when exposed.
5. Make external writes explicit, scoped, and reviewable through available draft
   or dry-run support.
6. Keep `--help` deterministic and offline.
7. Generate completion from authoritative option definitions when the runtime supports it.
8. For interactive output, map reachable states and terminal restoration paths.
9. For implementation or requested verification, exercise success and nearest
   failure through the public command. If claiming installation, use the existing
   installer in an isolated target and invoke the installed name from another
   directory. Source-only changes need no live HOME installation.

## Contract

For `--json`, emit one documented value or an explicit stream on stdout.
Send diagnostics and progress to stderr.
A failed operation exits nonzero.
An empty successful result remains distinct.
Redact secrets and unrelated payloads.
When external setup exists, expose its failures before authentication through an inspectable command such as `doctor --json`.

Keep completion local, fast, and free of network or mutation effects.
Restore terminal state after success, failure, cancellation, and interruption.
Preserve useful output with redirected streams, narrow widths, `NO_COLOR`, and limited Unicode support.

## References

- Read [agent commands](references/agent-cli-patterns.md) for external IDs, discovery, resolution, pagination, and JSON contracts.
- Read [command structure](references/command-building-blocks.md) for parameters, pure transformations, and composable personal tools.
- Read [terminal behavior](references/terminal-behavior.md) for interactive states, keyboard flow, and degraded output.
- When teach mode is requested or part of the existing command contract, read
  [teach mode](references/teach-mode.md) for source-backed guidance, privacy limits, and assistant adapters.
- Reuse [teach.mjs](scripts/teach.mjs) only when the existing Node runtime fits the consumer.
- When a Node example fits the existing consumer, read the
  [sample](assets/personal-size.mjs) and
  [output schema](assets/personal-size-result.schema.json).
- Read the [Zsh wrapper](assets/personal-size.zsh) only when the parent shell must supply opt-in session history.

## Completion

Report the contract, changed owner, success, rejection, and remaining external
dependencies. For design or review, distinguish proposed checks from executed cases.
For terminal changes, exercise keyboard flow, narrow widths, color-free output, redirected streams, and restoration.
For teach mode, distinguish adapter assertions from model behavior.
Installation and publication stay within the user's authorized scope.
