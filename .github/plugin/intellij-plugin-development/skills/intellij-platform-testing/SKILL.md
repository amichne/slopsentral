---
name: intellij-platform-testing
description: Use when choosing, implementing, debugging, or stabilizing IntelliJ Platform light tests, heavy tests, fixtures, project-model tests, or Starter and Driver UI automation.
---

# IntelliJ Platform Testing

Choose the lightest fixture that owns the required platform state. Read
[test-levels.md](references/test-levels.md) for light/heavy test boundaries and
reliability rules. Read [ui-automation.md](references/ui-automation.md) only
for behavior that requires a separate rendered IDE process.

## Workflow

1. State the user-visible or model-level behavior and the minimum platform
   services, indexes, project model, filesystem, or UI it needs.
2. Reuse the repository's existing base class and fixture conventions.
3. Prefer light tests for isolated PSI and project behavior. Use heavy tests
   only when a real project, module model, VFS/index persistence, or unsupported
   service surface requires one.
4. Make setup deterministic, isolate state, wait on named conditions, and
   retain the earliest failure and its logs.
5. Run the focused test first; widen only when shared fixture or packaging
   behavior changed.

Do not paper over platform leaks or timing races with sleeps, global retries,
or broad exception swallowing.
