---
name: ide-diagnostics-mcp
description: Use when inspecting a running IntelliJ IDE for freezes, high CPU, blocked threads, or action-specific regressions through diagnostics MCP, then escalating a named hot method to IDE Perf tracing when sampling is insufficient.
---

# IDE Diagnostics MCP

Use live process evidence for “what is this IDE doing now?” Do not substitute
repository text, build logs, or a profiler guess for a running-process sample.

## Capture

The MCP diagnostics surface requires the IDE to start with:

```text
-Didea.diagnostics.mcp.enabled=true
```

Start with a one-second sample, 25 top threads, and no raw dump. For a freeze,
blocked threads, or coroutines, use a bounded raw dump, 50 threads, and record
whether the dump was truncated or coroutine output was unavailable. Capture a
baseline and a sample while the named action is visibly slow.

Compare saved responses non-interactively:

```shell
scripts/intellij_diagnostics compare --before before.json --during during.json
```

Interpret CPU deltas, JVM thread states, blocked/waited deltas, native-frame
hints, and truncation as observations, not root-cause proof. A `RUNNABLE` thread
can still be in native I/O; `-1` means the JVM did not expose that metric.

## Escalate

Use IDE Perf only after MCP sampling names a concrete suspect method or the
user asks for call counts or action-correlated timing. Generate the bounded
tracing sequence:

```shell
scripts/intellij_diagnostics trace-plan \
  --method com.intellij.psi.PsiReference#resolve
```

Open `Help > Diagnostic Tools > Tracer`, issue `clear`, trace the concrete
method, reproduce once, retain the List/Tree observation, then issue `reset`.
Only concrete methods have bytecode to trace. Do not start with package-wide
wildcards or leave tracing active after capture.

Read [ide-perf.md](references/ide-perf.md) before enabling or installing IDE
Perf. Use JFR, async-profiler, or the IDE performance capture workflow for
allocations, long recordings, unknown hot paths, or native wait attribution.

## Safe VM Options

Preview custom override changes first:

```shell
scripts/intellij_diagnostics vm-options \
  --file /path/to/custom.vmoptions --enable both
```

Add `--apply` only with explicit authority. The helper requires an existing
custom override, rejects symlinks and installation-owned VM-option files,
creates an atomic backup before mutation, and is idempotent. It never installs
IDE Perf or restarts an IDE.

## Evidence

Record IDE product/build, action and timestamps, MCP request parameters,
before/during comparison, hot stack or method, truncation and coroutine flags,
and the next bounded experiment. State separately whether diagnostics MCP,
IDE Perf, and VM options are configured.
