# Test Levels and Reliability

Light tests use an in-memory project and module and are fast enough for focused
PSI and extension behavior. Heavy tests create a real project and module and
are appropriate when the behavior relies on persistent VFS/index state,
project roots/models, or platform services the light fixture cannot represent.
Choose by required state, not by the importance of the feature.

Keep test data explicit, paths normalized, and fixtures disposed by their
owner. Pump events or wait for a named background condition only when the API
contract requires it. Avoid fixed delays. On failure, retain the first stack,
IDE log, thread dump, and test data path before rerunning. A pass after retry is
flake evidence, not proof that the first failure was harmless.

Use the SDK's current fixture APIs from the resolved test framework; examples
can drift across platform builds. When a test depends on indexing, express
smart-mode readiness and avoid reusing cached project state between cases.

First-party sources, audited through
`JetBrains/intellij-sdk-docs@14ecf08ee392d9f42c0f4aadc5aafa911f156e22`:
[light and heavy tests](https://plugins.jetbrains.com/docs/intellij/light-and-heavy-tests.html)
and [testing FAQ](https://plugins.jetbrains.com/docs/intellij/testing-faq.html).
