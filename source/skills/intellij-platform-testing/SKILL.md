---
name: intellij-platform-testing
description: "Use for IntelliJ light/heavy fixtures, project-model tests, Starter/Driver UI automation, and live freezes or CPU regressions through diagnostics MCP and IDE Perf."
---

# IntelliJ Platform Testing

Choose the smallest fixture that owns the necessary Platform state.
For a live incident, collect evidence from the affected IDE process.
Repository text and build logs do not prove the state of that process.

## Workflow

1. Name the behavior and the services, indexes, project model, filesystem, or UI that it needs.
2. Inspect repository fixtures and the failure's actual execution layer.
   Use a unit or light test when its state faithfully represents the behavior.
   Use a heavy test for real project state, model persistence, or services absent from light fixtures.
3. Keep setup deterministic and state isolated. Wait on named conditions.
   Keep the earliest failure and its logs. Do not hide races with sleeps or global retries.
4. Run the focused test first. Expand only for a changed shared fixture or artifact interaction.
5. For a live freeze, blocked threads, or CPU regression, first discover an
   available connector to the affected process. Use diagnostics MCP when
   connected, otherwise the IDE's supported capture tools or supplied dumps.
   Capture a baseline and the named slow action; record truncation and missing
   telemetry. If process access is unavailable, report that limit instead of
   inferring live state from repository text.
6. Escalate to IDE Perf only for a concrete suspect method or requested call counts and action-correlated duration.
   Trace the smallest method set. Reset tracepoints after capture.
7. Keep VM-option edits, plugin installation, and IDE restart within their explicit authorization.
   Preview VM-option changes before mutation. Preserve the helper's unsafe-path rejection and backup behavior.
8. Report the exact fixture or IDE process, action, commands, parameters, outcomes, and evidence limits.
   Distinguish configured diagnostics, emitted telemetry, a live sample, and established cause.

## Reference Routing

- For light/heavy fixture choices, isolation, or reliability,
  read [test levels](references/test-levels.md).
- For behavior that needs a separate rendered IDE process,
  read [UI automation](references/ui-automation.md).
- For diagnostics MCP capture, saved-response comparison, safe VM options, or incident evidence,
  read [live diagnostics](references/live-diagnostics.md).
- Before IDE Perf setup or tracing, read [IDE Perf](references/ide-perf.md).

## Completion

The focused assertion runs and passes with the necessary Platform state.
Negative cases cover the changed rejection or lifecycle rule.
Live incident conclusions name the process, bounded samples, and unresolved causes.
A sample or fixture result does not prove recurrence or installed correctness outside its measured scope.
