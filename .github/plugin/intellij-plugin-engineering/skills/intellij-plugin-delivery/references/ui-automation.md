# Programmatic UI Automation

Use UI integration tests only for behavior that model-level IntelliJ tests
cannot prove: component registration and visibility, tool-window flows,
dialogs, focus, keyboard interaction, or end-to-end user stories.

## Preferred Contract

For a repository using IntelliJ Platform Gradle Plugin 2.x, prefer JetBrains
Starter plus Driver:

- Starter owns IDE download/configuration, the test project, plugin
  installation, process lifecycle, logs, and artifacts.
- Driver controls the separate IDE process and exposes a Kotlin DSL for UI
  components, actions, keyboard input, and assertions.
- Register the repository-owned JUnit 5 task through
  `intellijPlatformTesting.testIdeUi`; discover its actual name before running
  it. Root Platform projects own UI-test tasks when Module projects cannot.
- Use `testFramework(TestFrameworkType.Starter)` through the repository's
  pinned IntelliJ Platform Gradle Plugin. Do not copy dependency or IDE
  versions from documentation examples.

Do not introduce the older Remote Robot flow as a new default. Preserve it only
when the repository already owns and validates that contract. Driver and its UI
components are experimental, so keep selectors and task configuration narrow.

## Agent-Testable Shape

1. Keep the test project local, minimal, and immutable. Do not open the user's
   daily checkout or daily IDE profile.
2. Build the plugin distribution and install that exact artifact into the
   isolated Starter IDE.
3. Start with `runIdeWithDriver()` and guarantee shutdown with
   `useDriverAndCloseIde`.
4. Wait for indexing and relevant background indicators instead of fixed
   sleeps.
5. Invoke stable action IDs for commands when available. For visible behavior,
   scope queries through the component hierarchy and prefer accessible name,
   visible text, or component type.
6. Assert a user-visible result and, where useful, the underlying durable
   state. A click without an assertion is not a test.
7. Fail the test on IDE exceptions or freezes; retain the Starter logs and
   artifacts needed to diagnose the separate IDE process.

For selector discovery, use the remote Driver component-tree URL emitted in the
test logs. Inspect that HTML tree programmatically; do not assume a fixed port.
Avoid screen coordinates and screenshot-only matching as the primary oracle.

## Determinism and Safety

- Expose one non-interactive Gradle command agents can run with a focused test
  filter.
- Give each run an isolated sandbox and artifact directory.
- Make privacy, consent, project trust, and first-run state deterministic
  through the repository-owned test task rather than click-through setup.
- Bound waits around named readiness conditions. Do not hide a failure with
  blind retries.
- On macOS, keyboard simulation uses `java.awt.Robot` and may require
  Accessibility permission. Report that typed environment blocker instead of
  weakening the test.
- Keep CI display/runtime setup in the owning workflow and test it there; do
  not claim local success proves CI execution.

## Evidence

Record:

- the exact Gradle task and focused test selector;
- target IDE build and tested plugin artifact;
- semantic action/component selectors and the final assertion;
- pass/fail, IDE exit state, and exception/freeze result;
- relevant log, screenshot, and artifact paths on failure.

For Kast, implement this in an isolated worktree and sandbox.
`refreshDevelopmentMachine` validates the user's installed development bundle;
it is not the UI automation harness.

Authoritative references:
[integration-test setup](https://plugins.jetbrains.com/docs/intellij/integration-tests-intro.html),
[UI testing](https://plugins.jetbrains.com/docs/intellij/integration-tests-ui.html),
[testing extension](https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-testing-extension.html),
and [Gradle tasks](https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-tasks.html).
