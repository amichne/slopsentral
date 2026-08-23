# GraalVM native CLI

Use a native executable as an optional delivery mode. It is not a default rule
for every Kotlin CLI.

## Pass a feasibility gate first

Build a native CLI when startup time, idle memory, single-file distribution, or
container size matters enough to justify platform-specific build work. Before
committing to it:

- identify every target operating system and architecture;
- inspect the runtime dependency graph for reflection, dynamic proxies,
  resources, service loading, JNI, and dynamic class loading;
- confirm that required libraries publish or can generate reachability
  metadata;
- compare the native path with a JVM application distribution or thin launcher;
- define measured startup, memory, binary-size, and build-time acceptance
  targets.

Keep the CLI thin. Do not add a Ktor server, interactive terminal stack, or
large general-purpose dependency unless the command needs that behavior. Do not
distort a sound domain model merely to make native compilation pass.

## Isolate native-image wiring

- Apply and configure GraalVM Native Build Tools in the application or
  integration module. Pure contract and core modules must not know about the
  native-image plugin.
- Keep the main class, image name, build arguments, resources, and metadata in
  reproducible Gradle configuration.
- Prefer libraries that avoid runtime reflection. When dynamic behavior is
  required, use the reachability metadata repository or tracing agent, then
  review and narrow generated metadata before committing it.
- Build without a fallback image when the deliverable is meant to be native.
- Build each target on its target platform unless verified cross-compilation
  support exists for the exact toolchain.
- Keep the JVM distribution available when native delivery is experimental or
  does not pass its acceptance targets.

## Prove the produced executable

- Run JVM tests first, then `nativeTest` where it covers native behavior.
- Run `nativeCompile` and execute the produced binary. A successful image build
  is not enough.
- Exercise `--help`, `--version`, completion generation, the common default,
  one successful command, and one expected failure through the native binary.
- Test resource loading, serialization, service registration, TLS, and any
  other behavior that depends on reachability metadata.
- Record binary size, startup time, peak or steady memory, build time, GraalVM
  version, and target platform. Compare the results with the declared targets.
- Add a target-platform CI job only after the native path is an accepted
  deliverable.

## Official guidance

- [GraalVM Native Image Gradle plugin](https://graalvm.github.io/native-build-tools/latest/gradle-plugin.html)
- [Native Image tracing agent](https://www.graalvm.org/latest/reference-manual/native-image/metadata/AutomaticMetadataCollection/)
