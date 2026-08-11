# IntelliJ Platform Contracts

Use the resolved SDK and repository descriptor as the source of truth for exact
extension-point names and API signatures.

## Registration and Dependencies

- Treat `plugin.xml` as the runtime contract for actions, extensions,
  listeners, and non-light services. A class that compiles but is not registered
  through the correct mechanism is not a working feature.
- Declare the smallest platform module and bundled-plugin dependencies that
  provide the APIs used. Keep Gradle dependencies and `plugin.xml` runtime
  dependencies aligned.
- Verify extension-point spelling and attributes against the resolved IDE
  distribution or Plugin DevKit. Do not invent IDs from memory.
- Keep extension implementations cheap to construct and free of project- or
  request-specific mutable state. Put owned state in an application or project
  service.

## Lifetime, Coroutines, and Disposal

- Prefer light services when no interface or alternate implementation is
  required. Avoid heavy constructor work and constructor injection of other
  services.
- Inject a service-owned `CoroutineScope` for asynchronous work. Its
  cancellation must follow project close or plugin unload.
- Register listeners, message-bus connections, alarms, UI content, and other
  resources under a plugin-controlled disposable. Do not use `Application` or
  `Project` directly as a parent disposable.
- An extension registered in `plugin.xml` is not automatically disposed.
  Route cleanup through an owning service or explicit child disposable.
- Preserve the IDE's restart fallback. Claim restart-free update only after a
  real old-version to new-version install/unload probe on the named IDE build.

## Threading and Cancellation

- Perform PSI or document mutations in a write command so undo semantics are
  preserved. Keep preparation outside the write action.
- Keep blocking work off the Event Dispatch Thread. For Kotlin plugins on
  supported platform versions, prefer suspending read/write APIs and
  `Dispatchers.EDT` for UI handoff.
- Check cancellation in long loops and rethrow
  `ProcessCanceledException`/`CancellationException`.

## Focused Failure Checks

| Symptom | First boundary to inspect |
| --- | --- |
| Feature never appears | Descriptor registration and runtime dependency |
| Missing class at runtime | Bundled-plugin dependency and target product |
| UI freeze or assertion | EDT work, read/write scope, cancellation |
| Leak or unload failure | Static state, service scope, disposable tree |
| Read/write assertion | Access scope and write-command ownership |

Authoritative references:
[Threading Model](https://plugins.jetbrains.com/docs/intellij/threading-model.html),
[Services](https://plugins.jetbrains.com/docs/intellij/plugin-services.html),
[Disposer](https://plugins.jetbrains.com/docs/intellij/disposers.html),
[Dynamic Plugins](https://plugins.jetbrains.com/docs/intellij/dynamic-plugins.html),
and [PSI](https://plugins.jetbrains.com/docs/intellij/psi.html).
