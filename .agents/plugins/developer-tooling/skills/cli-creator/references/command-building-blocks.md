# Personal command building blocks

Design for a person solving a task now. The same command should compose with
other commands and expose enough structure for an agent to use reliably.

## Shape

Prefer a thin launcher and a cohesive implementation in the existing runtime.
Keep these operations separate only where their invariants differ:

1. Parse external arguments and configuration once into validated options.
2. Acquire named inputs through explicit file, process or network boundaries.
3. Select, filter, map, group or format through pure functions.
4. Present text, records or a schema-validated JSON result.
5. Apply an explicitly selected effect when the tool owns writes.

A second real consumer justifies extracting a shared block. Do not start with
a plugin loader, generic workflow engine or a registry of imagined providers.
Extension points should be explicit functions, finite supported variants, or
validated configuration data. Never `eval` user configuration as source.

## Parameters

Document the supported precedence, normally explicit arguments, tool-specific
environment, named project config, user config, then defaults. Omit layers with
no current consumer. Reject contradictory or unsupported combinations. Domain
values retain their identity after parsing; a validated path, threshold or
selection is not a string to be reinterpreted by every caller.

Make roots, filters, limits, formats and executable adapters configurable when
they vary in the requested workflow. Keep dependency-owned authentication and
model selection with the existing owner. Do not create another AI runtime.

## Composition

Use records on stdout and diagnostics on stderr. Define input formats, ordering,
empty results and nonzero failures. `--json` must produce one documented JSON
value or an explicitly documented stream. Avoid headings or progress in data.
Handle spaces and `--` correctly; use argument arrays for subprocesses.

For example, the retained sample owns only file-size inspection:

```sh
personal-size --min-bytes 1048576
personal-size --min-bytes 1048576 --json | jq '.files[].name'
personal-size --teach 'Find large files here and explain how to narrow the output'
```

The example reads regular visible files in the current directory, skips links,
and performs no writes. The pure threshold filter does not own directory reads
or teaching. Keep that separation when adding a second selector or renderer.

## Discoverability

Keep `--help` deterministic and offline, with defaults and examples. Generate
completion from the same option definitions. Only register command names owned
by the tool. Load twice without accumulating callbacks or PATH entries.

The sample prints Zsh source with `--completions zsh`; it contains no assistant
calls. Install through the verified completion/installer owner and inspect it
with `zsh -n` plus actual function loading. Unsupported shells should fail
explicitly rather than return an empty successful completion script.
