# Hooks and resources

Use hooks for configured host events.
Use resources when a consumer needs one executable or data file without a discoverable skill.

## Hook declarations and effects

`source/hooks/*.hook.json` declares canonical hooks and dependencies.
Host-specific files under `source/hooks/codex/` describe native commands.
Python helpers own most shared effects.
`source/hooks/pi/adapter.ts` maps them to Pi events.

The [Software Engineering context hook](../../source/hooks/software-engineering-context.hook.json) depends on shared instruction files.
The [context helper](../../source/hooks/inject-instruction-context.py) emits their content.
The host owns event delivery and context consumption.
Helper output alone cannot prove that a model used those instructions.

Software Engineering selects context and instruction-scope hooks.
Repository Knowledge selects knowledge hooks.
The other plugins select no automatic hooks.
A standalone hook declaration does not imply automatic installation.

## Native adapters

Pi maps canonical hooks to `before_agent_start`, `tool_call`, and `agent_before_settle`.
Slopsentral hooks start off in Pi. Use `/hooks` to select them.
Its adapter preserves earlier extension messages and continuation requests.
Amp supplies turn-start instructions, while its hooks remain reference-only.

Use [instruction scope](../agents-md-scope.md) for scope receipts and repair.
Use [Pi setup and recovery](../pi-install.md) for runtime preparation, `/hooks` controls, and event failures.
The [projection runbook](../pkl-projection.md) defines other provider limits.

## Turn optional hooks on or off in Codex

The Codex plugin registers the Software Engineering context hook.
The scope, knowledge drift, and knowledge overlay hooks need an explicit opt-in.
Each source declaration sets `codexActivation` to `opt-in`. The plugin includes those files for manual setup.

To turn on scope review, use the [scope installer](../agents-md-scope.md#install-on-this-computer).
To turn on a knowledge hook, copy its event group into your user or project `hooks.json`.
Use the [drift definition](../../source/hooks/codex/code-knowledge-drift.hooks.json) or [overlay definition](../../source/hooks/codex/knowledge-overlay.hooks.json).
Find the script under `source/hooks/` in a Slopsentral checkout.
Replace its relative path in the command with a quoted absolute path.
Keep the existing command options and other entries in `hooks.json`.
In Codex, open `/hooks` and review the entry you added.

To turn an entry off, use `/hooks` in the CLI or **Settings > Hooks** in the desktop app.
After an upgrade, examine user, project, and plugin entries from older installs.
If the same hook appears under several sources, turn off each unwanted entry.
See the [Codex hook guide](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks).

## Resources

A `RESOURCE` reference names one regular file and its resource dependencies.
Supported locations include a skill's `scripts/` or `assets/`, and `source/schemas/`.
A plugin selects resources directly, or a primitive selects them through `dependsOn`.

The [resource contract](../../source/schemas/primitives/resource-reference.schema.json) rejects unsupported external shapes.
Graph admission also rejects directories, symlinks, skill entry points, conflicting definitions, and dependency cycles.
Resource dependencies contain resources only.

For example, the Pkl helper resource depends on its adjacent lock.
The consumer gets both files without a second skill entry point.
[Workflow resources](../workflow-resources.md) supplies the full declaration and focused proof.

## Change evidence

Run the helper's focused tests and the source graph gate after a hook change.
After an adapter change, exercise that adapter's actual event path.
Use a rejection case for missing dependencies or invalid input.
Keep adapter results separate from native host evidence.
The [contribution guide](contribute.md#choose-the-smallest-gate) lists repository commands.
