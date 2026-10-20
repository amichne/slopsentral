# IDE Perf Escalation and Provenance

Use IDE Perf after a live sample identifies a concrete suspect method.
It can trace concrete methods in real time and show aggregate and call-tree data.
It can also inspect IntelliJ-specific `CachedValue` and VFS behavior.
Broad traces add noise and retransformation cost.
Trace the smallest method set that distinguishes the current hypothesis.
Reset the tracepoints after capture.

The helper only emits the official non-interactive installation command:

```shell
uv run --locked python scripts/intellij_diagnostics ide-perf-command \
  --app "/Applications/IntelliJ IDEA.app"
```

The helper does not run that command. Installation and IDE restart need their own authority.
If IDE Perf cannot attach, preview `-Djdk.attach.allowAttachSelf=true` in the existing custom VM-options override.
Apply that change only when the task authorizes it.
Do not edit the application bundle's default file.

## Audited Source

- [google/ide-perf](https://github.com/google/ide-perf/tree/26d3a1e834eb78c36585f0d080ceaa080e580b3d), audited at commit
  `26d3a1e834eb78c36585f0d080ceaa080e580b3d`, Apache-2.0.
- [IDE Perf user guide](https://github.com/google/ide-perf/blob/26d3a1e834eb78c36585f0d080ceaa080e580b3d/docs/user-guide.md).
- [JetBrains custom VM options](https://www.jetbrains.com/help/idea/tuning-the-ide.html).
- [JetBrains command-line plugin installation](https://www.jetbrains.com/help/idea/managing-plugins.html).

This local workflow preserves the upstream source attribution.
It does not copy the upstream plugin, documentation, or implementation.
