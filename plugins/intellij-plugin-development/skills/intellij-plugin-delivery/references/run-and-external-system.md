# Run Configurations and External Systems

## Run Configurations

Register `ConfigurationType` with `com.intellij.configurationType`; use
factories for distinct configuration shapes. Keep persisted options separate
from UI editors. `SettingsEditor.resetEditorFrom` projects state into the UI;
`applyEditorTo` validates and commits it. Build execution from the supplied
`ExecutionEnvironment`, return an execution result with the real process
handler and console, and terminate/cancel through that handler.

Configuration producers must recognize existing configurations before
creating new ones and compare context semantically so gutter/context actions
do not multiply equivalent entries. Test state serialization and invalid
settings independently from process execution.

## External System

Treat the external project path and system ID as durable identity. Separate
external model acquisition from translation to IntelliJ project data. Reimport
must update, add, and remove owned nodes idempotently without deleting state
owned by another integration. Preserve cancellation and structured external
errors at the boundary. Use External System task APIs for external build/tool
execution rather than constructing an unrelated run configuration protocol.

Test initial import, unchanged reimport, changed and removed modules/libraries,
task discovery/execution, cancellation, and project disposal. Use a heavy test
when the real project model or persistence is the behavior under test.

First-party sources, audited through
`JetBrains/intellij-sdk-docs@14ecf08ee392d9f42c0f4aadc5aafa911f156e22`:
[run configurations](https://plugins.jetbrains.com/docs/intellij/run-configurations.html)
and [External System integration](https://plugins.jetbrains.com/docs/intellij/external-system-integration.html).
