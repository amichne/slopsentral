# Gradle dynamic tools POC

This Kotlin application runs a persistent, repository-bound Gradle service and exposes it to stock
Codex CLI conversations as an experimental `gradle` dynamic-tool namespace. A loopback WebSocket
bridge lets `codex --remote` use the namespace without MCP. The namespace exposes six operations:

- `start` launches repository wrapper tasks or filtered tests without a shell.
- `observe` returns cursor-addressed output and terminal state.
- `cancel` idempotently requests cancellation.
- `discover` reads bounded task metadata through an isolated repository-wrapper probe.
- `history` lists or reads repository-persistent run summaries.
- `debug` attaches to a debug-enabled test JVM and inspects or controls it through JDI.

The service accepts only the executable `gradlew` file under its admitted repository. It keeps one
active run per repository, represents Gradle build failure as terminal `FAILED` data, and requests
cancellation of an active run when the service exits. Codex adapter processes can disconnect
without cancelling a service-owned run.

The Gradle wire protocol is JSON Lines over a loopback-only TCP socket. Each connection must
complete a versioned handshake for the server's canonical repository path and dynamic-tool schema
fingerprint before it can call a tool. Frames are strictly decoded, capped at 1,048,576
characters, and rejected as finite protocol failures. The socket is a local transport boundary,
not an authenticated remote-network service.

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

## Native executable

### Select GraalVM with SDKMAN

The SDKMAN `21.0.11-graal` distribution already contains `native-image`; it does not require a
separate `gu install native-image` step. Select it for the current shell and verify both tools:

```shell
sdk use java 21.0.11-graal
export GRAALVM_HOME="$JAVA_HOME"
rehash

java -version
native-image --version
```

When several JDKs are installed, Gradle toolchain detection can still select a non-GraalVM JDK.
Bind both homes explicitly, put GraalVM first on `PATH`, and stop existing Gradle daemons before a
native build:

```shell
gradle_tools_graalvm_home="$(sdk home java 21.0.11-graal)"
export JAVA_HOME="$gradle_tools_graalvm_home"
export GRAALVM_HOME="$gradle_tools_graalvm_home"
export PATH="$gradle_tools_graalvm_home/bin:$PATH"
rehash

./gradlew --stop
./gradlew test
./gradlew nativeCompile --no-configuration-cache
```

This explicit selection follows the
[GraalVM Native Build Tools guidance](https://graalvm.github.io/native-build-tools/latest/gradle-plugin.html),
which notes that Gradle cannot reliably distinguish GraalVM from ordinary JDK installations in a
multi-JDK environment.

### Prove the produced binary

A successful image build is not sufficient. Exercise the real executable:

```shell
./build/native/nativeCompile/gradle-dynamic-tools --version
./build/native/nativeCompile/gradle-dynamic-tools --help
```

Also verify one expected failure, start the native `serve` and `bridge` processes, and complete an
App Server WebSocket initialization through the bridge. The reference macOS arm64 build used
Oracle GraalVM 21.0.11 and proved all of those paths. The v0.2.0 facade build produced a 57.57 MB
executable in 1 minute 26 seconds with 3.43 GB peak resident memory.

GraalVM 21 may warn that a reachability-metadata `typeReached` condition is unsupported and will be
treated as always true. This is conservative and did not prevent the reference image from building
or running, but it can retain more metadata than a newer GraalVM. Keep the JVM distribution
available while native delivery remains experimental.

### Publish a release

The [release workflow](../../../.github/workflows/release-gradle-dynamic-tools.yml) builds no-fallback
images on their target platforms:

- macOS arm64 on `macos-15`;
- Linux x64 on `ubuntu-latest`.

Pull requests that touch this tool or its workflow build, test, smoke-test, package, checksum, and
upload both native archives as workflow artifacts. Pushing a matching release tag additionally
creates or reconciles a GitHub prerelease and uploads both archives and their SHA-256 files. The
workflow uses the repository `GITHUB_TOKEN`; basic prerelease publication needs no additional
secret.

`gradle-dynamic-tools-v0.1.0` already identifies the original POC release. This working tree targets
v0.2.0; publish it as a new version rather than moving the old tag. Before creating that tag,
confirm that every current version source still agrees:

- `version` in [build.gradle.kts](build.gradle.kts);
- `ReleaseVersion.CURRENT` in
  [ReleaseVersion.kt](src/main/kotlin/io/github/amichne/slopsentral/gradle/domain/ReleaseVersion.kt);
- the App Server client version in
  [CodexAppServerClient.kt](src/main/kotlin/io/github/amichne/slopsentral/gradle/appserver/CodexAppServerClient.kt);
- `GRADLE_DYNAMIC_TOOLS_VERSION` in the
  [release workflow](../../../.github/workflows/release-gradle-dynamic-tools.yml);
- versioned download examples in this README.

After the version change has passed review and the two-platform native workflow, tag the exact
release commit and push the tag:

```shell
git tag -a gradle-dynamic-tools-v0.2.0 -m "Gradle Dynamic Tools 0.2.0"
git push origin gradle-dynamic-tools-v0.2.0
```

Creating or pushing a release tag is a publication action. Confirm the target commit and obtain
explicit approval before running these commands. After publication, verify the release target,
assets, and checksums:

```shell
gh release view gradle-dynamic-tools-v0.2.0 \
  --repo amichne/slopsentral
gh release download gradle-dynamic-tools-v0.2.0 \
  --repo amichne/slopsentral \
  --dir /tmp/gradle-dynamic-tools-v0.2.0
(cd /tmp/gradle-dynamic-tools-v0.2.0 && shasum -a 256 -c ./*.sha256)
```

### Distribution hardening

Checksums make the current prereleases publishable, but the workflow does not yet provide every
production distribution control:

- The macOS binary is linker-signed ad hoc. For normal Gatekeeper acceptance, sign it with a
  Developer ID Application certificate, enable hardened runtime and a secure timestamp, then
  submit it with `notarytool`. See
  [Apple's notarization requirements](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).
- Extend the native facade lifecycle smoke test to perform a real App Server WebSocket
  initialization. The current workflow proves that both embedded layers start and stop around a
  fake Codex process; the full bridge initialization proof has only been run locally.
- Add GitHub artifact provenance with `actions/attest` and the required `id-token: write` and
  `attestations: write` permissions. See
  [GitHub's artifact-attestation guide](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations).
- Consider `--enable-sbom`, a single generated version source, and a Windows x64 matrix entry if
  those become release requirements.

### Fetch, install, and open Codex

After the current facade is published, this one command resolves the newest
`gradle-dynamic-tools-v*` tag, downloads the native archive for the current platform, verifies its
published SHA-256 checksum, installs it under `~/.local/bin`, and opens Codex for the current Gradle
repository:

```shell
curl -fsSL \
  https://raw.githubusercontent.com/amichne/slopsentral/main/source/tools/gradle-dynamic-tools/install.sh \
  | bash -s -- --cwd "$PWD"
```

For the inspect-before-running form:

```shell
curl -fsSLo /tmp/install-gradle-dynamic-tools.sh \
  https://raw.githubusercontent.com/amichne/slopsentral/main/source/tools/gradle-dynamic-tools/install.sh
less /tmp/install-gradle-dynamic-tools.sh
bash /tmp/install-gradle-dynamic-tools.sh --cwd "$PWD"
```

The installer supports the published macOS arm64 and Linux x64 images. Set
`GRADLE_DYNAMIC_TOOLS_INSTALL_ONLY=1` to install without opening Codex,
`GRADLE_DYNAMIC_TOOLS_INSTALL_DIR` to choose another binary directory, or
`GRADLE_DYNAMIC_TOOLS_VERSION` to pin an exact release. Once installed, the equivalent reusable
command is:

```shell
gradle-dynamic-tools codex --cwd /path/to/gradle/repository
```

Arguments after `--` pass unchanged to the stock Codex CLI:

```shell
gradle-dynamic-tools codex \
  --cwd /path/to/gradle/repository \
  -- --model gpt-5.4
```

### Install a published archive manually

For example, install the existing macOS arm64 v0.1.0 archive with GitHub CLI:

```shell
gh release download gradle-dynamic-tools-v0.1.0 \
  --repo amichne/slopsentral \
  --pattern 'gradle-dynamic-tools-0.1.0-macos-arm64.tar.gz'
tar -xzf gradle-dynamic-tools-0.1.0-macos-arm64.tar.gz
install -m 755 \
  gradle-dynamic-tools-0.1.0-macos-arm64/gradle-dynamic-tools \
  ~/.local/bin/gradle-dynamic-tools
```

## Interactive Codex CLI bridge

The `codex` facade is the normal interactive entry point. It starts the repository-bound Gradle
service on an ephemeral loopback port, starts the App Server bridge on another ephemeral loopback
port, and launches `codex --remote` with the requested working directory and arguments. Both
embedded servers stay alive for the full Codex session and shut down after the TUI exits:

```shell
gradle-dynamic-tools codex --cwd /path/to/gradle/repository
```

No separately managed `serve` or `bridge` process is required. The native image contains both
layers; the only external runtime dependency is the installed, authenticated Codex CLI that the
facade launches.

For protocol development or a daemon whose lifetime is independent of one Codex TUI, the lower
level commands remain available. Start the service:

```shell
gradle-dynamic-tools serve \
  --cwd /path/to/gradle/repository \
  --listen 127.0.0.1:48173
```

Then start the bridge and connect Codex from separate terminals:

```shell
gradle-dynamic-tools bridge \
  --cwd /path/to/gradle/repository \
  --server 127.0.0.1:48173 \
  --listen 127.0.0.1:4500

codex --remote ws://127.0.0.1:4500 -C /path/to/gradle/repository
```

The bridge refines the TUI's `initialize` request to enable the experimental API and adds the
canonical Gradle namespace to each `thread/start`. It consumes only `gradle` `item/tool/call`
requests, forwards them to the persistent Gradle service, and returns the typed result to App
Server. Notifications, approvals, ordinary tools, turn streaming, and all other messages remain
between the stock TUI and the stock `codex app-server --stdio` process. Each TUI WebSocket
connection owns one stdio App Server process; the Gradle process and run history remain owned by
the persistent service.

Both listeners are deliberately loopback-only and unauthenticated. Threads created through the
bridge retain their dynamic-tool metadata when App Server resumes them. This first pass does not
retrofit the namespace onto threads that were created without the bridge.

## One-shot adapter

To run one prompt without the interactive TUI, start a Codex App Server turn whose dynamic tools
forward to the persistent service:

```shell
./build/install/gradle-dynamic-tools/bin/gradle-dynamic-tools \
  --cwd /path/to/gradle/repository \
  --server 127.0.0.1:48173 \
  -- "Run :app:test, observe it until terminal, and summarize any failures."
```

Omit `--server` to retain the original one-shot local mode. For the Gradle service, use
`--listen 127.0.0.1:0` when an operating-system-selected port is useful; the ready line reports the
bound endpoint.

This first pass validates persistent execution ownership, stock-TUI dynamic tools, and non-MCP
forwarding. Parallel Gradle runs, persisted console output, configurable JDWP ports, breakpoint
mutation, expression evaluation, authenticated transports, and non-loopback transports remain out
of scope.
