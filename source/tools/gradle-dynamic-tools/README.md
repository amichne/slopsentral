# Gradle dynamic tools POC

This Kotlin host starts one ephemeral Codex App Server thread and registers an experimental
`gradle` dynamic-tool namespace. The namespace exposes three operations:

- `start` launches repository wrapper tasks or filtered tests without a shell.
- `observe` returns cursor-addressed output and terminal state.
- `cancel` idempotently requests cancellation.

The host accepts only the executable `gradlew` file under the thread working directory. It keeps
one active run per host, represents Gradle build failure as terminal `FAILED` data, and closes any
active run when the host exits.

Run the focused checks:

```shell
./gradlew test
```

Start one model turn against another Gradle repository:

```shell
./gradlew installDist
./build/install/gradle-dynamic-tools/bin/gradle-dynamic-tools \
  --cwd /path/to/gradle/repository \
  -- "Run :app:test, observe it until terminal, and summarize any failures."
```

The POC intentionally omits debugger attachment, task discovery, persistent run history, and
parallel runs. The next debugger slice should attach through JDI to a JDWP-enabled test JVM while
preserving the same run ID and lifecycle.
