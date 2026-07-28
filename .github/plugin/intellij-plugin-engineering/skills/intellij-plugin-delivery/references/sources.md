# Sources and Synthesis Record

This skill is a local rewrite. It does not copy upstream skill payloads,
scripts, examples, or templates.

## Audited Skills

| Source | Audited commit | License | Decision |
| --- | --- | --- | --- |
| [gadfly3173/intellij-platform-sdk-skills](https://github.com/gadfly3173/intellij-platform-sdk-skills) | `9f504a29bc9c88dce59e94b72ebb4bce36d9b5b3` | MIT | Primary reference for progressive routing, current platform topics, PSI, lifecycle, compatibility, and verification |
| [buyoung/skills](https://github.com/buyoung/skills) | `dc29214c7317d0e96c80835ed6330fd61c2bd0b0` | MIT | Retain the compact mental model, diagnostic orientation, and preflight discipline; omit the 120-file payload |
| [duckyman-ai/agent-skills](https://github.com/duckyman-ai/agent-skills) | `3f4e102ad2c0172f1dc95784058a8413d4803f6e` | MIT | Do not retain hardcoded build ranges or universal Kotlin, JDK, VFS, and author-signing claims |
| [titonio/opencode-jb](https://github.com/titonio/opencode-jb) | `69bebeabe2dcf55d4681380697909bdc41df7847` | MIT | Reject missing claimed SDK docs, mismatched runtime paths, unsafe interactive scaffolding, absent wrapper generation, and stale templates |

The duplicate `intellij-platform-sdk` request was audited once at the same
commit.

## Synthesis Boundary

Retain:

- repository-first discovery instead of template-first modification;
- `plugin.xml` and dependency alignment;
- service-owned state and lifecycle;
- threading, cancellation, dumb-mode, and PSI validity rules;
- focused tests, Plugin Verifier, sandbox, packaging, and delivery separation.

Exclude:

- project/action scaffolding scripts and boilerplate assets;
- full offline SDK documentation copies;
- fixed platform, Gradle, Kotlin, or JDK versions;
- LSP, MCP, JCEF, theme, language-parser, and Marketplace feature tours that
  are unrelated to Kast's active delivery path;
- claims that conflict with repository instructions or current JetBrains docs.

## First-Party References

- [IntelliJ Platform Plugin SDK](https://plugins.jetbrains.com/docs/intellij/welcome.html)
- [IntelliJ Platform Gradle Plugin 2.x](https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin.html)
- [Integration Test Setup](https://plugins.jetbrains.com/docs/intellij/integration-tests-intro.html)
- [Integration Tests: UI Testing](https://plugins.jetbrains.com/docs/intellij/integration-tests-ui.html)
- [Threading Model](https://plugins.jetbrains.com/docs/intellij/threading-model.html)
- [PSI](https://plugins.jetbrains.com/docs/intellij/psi.html)
- [Dynamic Plugins](https://plugins.jetbrains.com/docs/intellij/dynamic-plugins.html)
- [Plugin Compatibility](https://plugins.jetbrains.com/docs/intellij/plugin-compatibility.html)
- [Plugin Signing](https://plugins.jetbrains.com/docs/intellij/plugin-signing.html)

JetBrains currently documents Starter plus Driver as the integrated UI-test
path. Driver and its UI components remain experimental, so repository-pinned
APIs and the target IDE build override examples in the documentation.
