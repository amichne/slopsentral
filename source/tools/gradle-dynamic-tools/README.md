# Gradle dynamic tools POC

This Kotlin host starts one ephemeral Codex App Server thread and registers an experimental
`gradle` dynamic-tool namespace. The namespace exposes six operations:

- `start` launches repository wrapper tasks or filtered tests without a shell.
- `observe` returns cursor-addressed output and terminal state.
- `cancel` idempotently requests cancellation.
- `discover` reads bounded task metadata through an isolated repository-wrapper probe.
- `history` lists or reads repository-persistent run summaries.
- `debug` attaches to a debug-enabled test JVM and inspects or controls it through JDI.

The host accepts only the executable `gradlew` file under the thread working directory. It keeps
one active run per repository across host processes, represents Gradle build failure as terminal
`FAILED` data, and requests cancellation of an active run when the host exits.

Run summaries and the active-run lock live under `.gradle/codex-dynamic-tools` in the target
repository. Summaries contain lifecycle metadata and the displayed command, but not console output.
An active summary whose owning process no longer holds the lock is returned as `ABANDONED` by a new
host.

JDWP is available only for filtered `TESTS` starts with `"debug":{"type":"JDWP"}`. The host adds
Gradle's `--debug-jvm` option, so the test JVM starts suspended on `127.0.0.1:5005`. The `debug` tool
supports `ATTACH`, `THREADS`, `STACK`, `PAUSE`, `RESUME`, and `DETACH`. This POC uses Gradle's fixed
debug port and does not yet set breakpoints or evaluate expressions.

Run the focused checks:

```shell
./gradlew test
```

Build and smoke-test the native executable with a GraalVM 21 JDK:

```shell
./gradlew nativeCompile
./build/native/nativeCompile/gradle-dynamic-tools --version
./build/native/nativeCompile/gradle-dynamic-tools --help
```

Tagged releases publish no-fallback native archives for macOS arm64 and Linux x64. For example,
install the macOS archive with GitHub CLI:

```shell
gh release download gradle-dynamic-tools-v0.1.0 \
  --repo amichne/slopsentral \
  --pattern 'gradle-dynamic-tools-0.1.0-macos-arm64.tar.gz'
tar -xzf gradle-dynamic-tools-0.1.0-macos-arm64.tar.gz
install -m 755 \
  gradle-dynamic-tools-0.1.0-macos-arm64/gradle-dynamic-tools \
  ~/.local/bin/gradle-dynamic-tools
```

Start one model turn against another Gradle repository:

```shell
./gradlew installDist
./build/install/gradle-dynamic-tools/bin/gradle-dynamic-tools \
  --cwd /path/to/gradle/repository \
  -- "Run :app:test, observe it until terminal, and summarize any failures."
```

The POC intentionally omits parallel runs, persisted console output, configurable JDWP ports,
breakpoint mutation, and expression evaluation.
