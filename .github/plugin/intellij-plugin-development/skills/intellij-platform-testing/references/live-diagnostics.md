# Live IDE Diagnostics

Use diagnostics MCP for a sample from the affected IDE process.
The IDE needs this VM option at startup:

```text
-Didea.diagnostics.mcp.enabled=true
```

## Capture and Compare

Start with a one-second sample, 25 top threads, and no raw dump.
For a freeze, blocked threads, or coroutines, use a bounded raw dump and 50 threads.
Record truncation and unavailable coroutine output. Capture a baseline and the named slow action.

From this skill directory, compare saved responses with the Python helper:

```text
uv run --locked python scripts/intellij_diagnostics compare --before before.json --during during.json
```

The comparison reports CPU deltas, JVM thread states, blocked/waited deltas, and native-frame hints.
These measurements do not establish cause. A `RUNNABLE` thread can occupy native I/O.
A metric value of `-1` means that the JVM did not expose that metric.

## Unresolved runtime questions

Use built-in IDE diagnostics and existing JDK Flight Recorder evidence for the named process.
Keep recording scope and duration bounded by the user's request.
If those capabilities are unavailable, report the missing evidence.
Do not install an outside profiler or IDE plugin to fill the gap.

## Safe VM Options

Preview changes to an existing custom override:

```text
uv run --locked python scripts/intellij_diagnostics vm-options --file /path/to/custom.vmoptions --enable mcp
```

Use `--apply` only when the task authorizes that mutation.
The helper rejects symlinks and installation-owned VM-option files.
It creates a backup before atomic replacement and leaves existing options unchanged on repeated calls.
It does not install plugins or restart the IDE.

## Evidence

Record the IDE product/build, process identity, action, timestamps, request parameters,
comparison, hot stack or method, truncation, and coroutine availability.
Name the next bounded experiment. State whether native diagnostics MCP and VM options are configured separately.
