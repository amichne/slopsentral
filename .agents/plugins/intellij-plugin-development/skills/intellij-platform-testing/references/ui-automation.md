# Programmatic UI Automation

Use UI integration tests only for behavior model-level tests cannot prove:
component registration and visibility, tool-window flows, dialogs, focus,
keyboard interaction, or end-to-end user stories.

For IntelliJ Platform Gradle Plugin 2.x, prefer repository-owned JUnit 5
Starter plus Driver tasks. Starter owns the isolated IDE, test project, exact
plugin artifact, lifecycle, logs, and artifacts. Driver controls the separate
process. Discover the actual `intellijPlatformTesting.testIdeUi` task and use
the repository's pinned dependencies.

Build and install the exact plugin artifact, wait for named readiness, use
stable action IDs or hierarchically scoped accessible component selectors, and
assert a visible result. Guarantee IDE shutdown and retain logs, screenshots,
component-tree output, exceptions, and freeze evidence. Never use the daily IDE
profile, coordinate clicks, screenshot matching as the primary oracle, or fixed
sleeps. Preserve Remote Robot only when the repository already owns it.

Authoritative references:
[integration-test setup](https://plugins.jetbrains.com/docs/intellij/integration-tests-intro.html),
[UI testing](https://plugins.jetbrains.com/docs/intellij/integration-tests-ui.html),
and [testing extension](https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-testing-extension.html).
