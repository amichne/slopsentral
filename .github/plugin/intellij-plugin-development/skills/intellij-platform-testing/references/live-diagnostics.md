# Live IDE Diagnostics

Use diagnostics MCP when the host exposes a connection to the affected IDE.
The VM option below enables IDE support, but does not install or connect a host
MCP client. Discover the available tools before calling them; Pi and Amp do not
gain that connection from this skill package. If unavailable, use the IDE's
supported thread dump or performance capture workflow and label the evidence.
The IDE needs this VM option at startup for diagnostics MCP:

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

## Trace a Concrete Method

After a sample identifies a suspect method, generate a bounded IDE Perf sequence:

```text
uv run --locked python scripts/intellij_diagnostics trace-plan --method com.intellij.psi.PsiReference#resolve
```

The same path applies when the user asks for call counts or action-correlated duration.
Open `Help > Diagnostic Tools > Tracer`. Issue `clear`.
Trace the concrete method. Reproduce the action once.
Keep the List/Tree result. Issue `reset`.

Only concrete methods have bytecode to trace. Do not start with package-wide wildcards.
Read [IDE Perf](ide-perf.md) before setup or tracing.
Use JFR, async-profiler, or the IDE performance capture workflow for allocation evidence, long recordings, unknown hot paths, or native waits.

## Safe VM Options

Preview changes to an existing custom override:

```text
uv run --locked python scripts/intellij_diagnostics vm-options --file /path/to/custom.vmoptions --enable both
```

Use `--apply` only when the task authorizes that mutation.
The helper rejects symlinks and installation-owned VM-option files.
It creates a backup before atomic replacement and leaves existing options unchanged on repeated calls.
It does not install IDE Perf or restart the IDE.

## Evidence

Record the IDE product/build, process identity, action, timestamps, request parameters,
comparison, hot stack or method, truncation, and coroutine availability.
Name the next bounded experiment. State whether diagnostics MCP, IDE Perf, and VM options are configured separately.
