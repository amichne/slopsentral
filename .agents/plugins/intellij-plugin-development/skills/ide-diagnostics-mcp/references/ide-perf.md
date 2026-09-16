# IDE Perf Escalation and Provenance

IDE Perf is a targeted follow-up to live sampling, not a default profiler. It
can trace concrete methods in real time, show aggregate and call-tree data, and
inspect IntelliJ-specific `CachedValue` and VFS behavior. Broad tracing adds
noise and retransformation cost; trace the smallest method set that tests the
current hypothesis and reset it afterward.

The helper only emits the official non-interactive installation command:

```shell
scripts/intellij_diagnostics ide-perf-command \
  --app "/Applications/IntelliJ IDEA.app"
```

It does not execute the command. Installation and IDE restart remain explicit
user actions. If IDE Perf cannot attach, preview then explicitly apply
`-Djdk.attach.allowAttachSelf=true` to the IDE's existing custom VM-options
override; never edit the application bundle's default file.

## Audited Source

- [google/ide-perf](https://github.com/google/ide-perf/tree/26d3a1e834eb78c36585f0d080ceaa080e580b3d), audited at commit
  `26d3a1e834eb78c36585f0d080ceaa080e580b3d`, Apache-2.0.
- [IDE Perf user guide](https://github.com/google/ide-perf/blob/26d3a1e834eb78c36585f0d080ceaa080e580b3d/docs/user-guide.md).
- [JetBrains custom VM options](https://www.jetbrains.com/help/idea/tuning-the-ide.html).
- [JetBrains command-line plugin installation](https://www.jetbrains.com/help/idea/managing-plugins.html).

This skill synthesizes the operating boundary and commands; it does not copy
the upstream plugin, documentation, or implementation.
