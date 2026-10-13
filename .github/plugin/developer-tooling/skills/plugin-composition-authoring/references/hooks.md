# Hook Contracts

Keep neutral metadata at `source/hooks/<name>.hook.json`.
Keep provider-neutral code under `source/hooks/` and provider adapters under `source/hooks/<adapter>/`.
Declare canonical dependencies with `dependsOn`.
Never copy another primitive into the hook.

## Input and Effects

Define the event, trigger timing, input schema, output schema, timeout, and failure policy.
Parse event payloads once at the input adapter.
Pass refined values into pure decisions.
Translate known failures into finite outcomes.
Report unknown failures with bounded stage evidence.
Do not log secrets or unbounded event payloads.

New automation uses `python-tooling` with required uv, PEP 723, committed locks, and `tool.uv.no-build = true`.
Use strict Pyright, Ruff, and pytest.
Keep shell only for an unavoidable host launcher or state owned by the parent shell.
Do not place business logic, parsers, pipelines, or cleanup in shell.

Passive context hooks read bundled policy without repository writes.
They cannot claim that the host loaded their output.
Use the host's `PLUGIN_DATA` capability for plugin-owned state.
Use repository-local state only when the consuming repository opts into it.

## Codex Adapters

Codex adapters use one top-level `hooks` key.
Keep `$schema`, descriptions, and neutral metadata outside the runtime adapter.
Matcher groups contain `matcher` and `hooks` only.
Command handlers use the supported command, timeout, and status fields.
Use `additionalContextLimit` only when the command emits context.
Keep command paths relative to the runtime payload.

- `SessionStart` emits JSON with `hookSpecificOutput.hookEventName` equal to `SessionStart` and bounded `additionalContext`.
- `UserPromptSubmit` can own prompt-scoped state.
- `PostToolUse` can record declared tool effects.
- `Stop` emits one Codex response object on stdout.

For `Stop`, adapt domain results to `systemMessage` or `decision: "block"` with a bounded `reason`.
Keep human reports, TOON, and domain JSON outside the host response.
Keep CLI exit codes separate from the host's decision field.

## Evidence

Run `node tools/validate-source-graph.mjs` for metadata, dependencies, executable paths, adapters, and schema-linked sidecars.
Sidecars carry their owning `$schema` under `source/schemas/`.
Run the configured command outside the plugin root with accepted, skipped, malformed, and rejected inputs.
Examine stdout as a host response, not merely parseable JSON.
Use executable assertions for timeout and failure behavior that the changed code owns.
Static adapter acceptance does not prove host execution.
