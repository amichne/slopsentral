# Build and Verification

Discover the build before choosing commands. The repository owns its wrapper,
Gradle plugin version, target products, platform builds, Kotlin version,
toolchain, bytecode target, compatibility range, and publication path.

## Discovery

Inspect:

- `settings.gradle(.kts)`, root and plugin-module build files;
- `gradle.properties`, version catalogs, and wrapper properties;
- `plugin.xml` plus optional descriptors;
- CI and release workflows that consume the plugin ZIP;
- nearby repository instructions and existing focused tests.

Do not upgrade versions as incidental cleanup. A current upstream release is
research input, not authority to change a pinned build.

## Widening Verification

1. Run the smallest affected compile or test target.
2. Run the owning plugin-module test/check task when shared behavior changed.
3. Run `verifyPluginProjectConfiguration` or `verifyPluginStructure` when
   project configuration, descriptors, or archive shape changed.
4. Run `buildPlugin` when the distributable ZIP or its consumers are affected.
5. Run `verifyPlugin` when platform APIs, declared products, bundled-plugin
   dependencies, `sinceBuild`, or the compatibility matrix changed.
6. Run `runIde` or the repository's sandbox task only for behavior requiring a
   live IDE. Inspect the sandbox `idea.log` for relevant new failures.

Task names may be customized; use `./gradlew tasks` and the existing build
instead of assuming a template.

## Compatibility

- Compile against the repository-selected platform and language level.
- Derive Java/JDK requirements from the targeted platform builds; do not apply
  one universal JDK rule to every supported IDE version.
- Keep Gradle dependencies and `plugin.xml` dependencies consistent across
  every declared target product.
- Treat Plugin Verifier findings by category. Missing APIs, internal API use,
  invalid overrides, and missing classes require an owning fix or an explicit,
  documented compatibility decision.
- Do not widen `sinceBuild`/`untilBuild` beyond tested evidence.

## Distribution Ownership

`buildPlugin`, signing, Marketplace publication, custom update feeds, GitHub
Releases, and local IDE installation are separate stages. Configure only the
stages the repository owns:

- Do not add certificate or Marketplace secrets to a module that only builds an
  unsigned ZIP.
- Do not infer that every Marketplace upload must be author-signed; follow the
  repository's release policy and current Marketplace requirements.
- Do not claim a running IDE uses a new ZIP until installation/restart state is
  verified.
- Do not claim publication until the owning remote workflow and artifact state
  are terminal and verified.

Authoritative references:
[Gradle Plugin 2.x](https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin.html),
[Gradle configuration](https://plugins.jetbrains.com/docs/intellij/configuring-gradle.html),
[build ranges](https://plugins.jetbrains.com/docs/intellij/build-number-ranges.html),
[plugin compatibility](https://plugins.jetbrains.com/docs/intellij/plugin-compatibility.html),
and [plugin signing](https://plugins.jetbrains.com/docs/intellij/plugin-signing.html).
