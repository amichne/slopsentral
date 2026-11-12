# Gradle Build Logic And Incremental Contracts

Read before changing settings, catalogs, dependency declarations, convention
plugins, custom tasks, generators, or module edges. Kotlin Design Practices owns
this authoring contract; use `gradle-performance-engineering` for measured
speedup claims. It does not require the explicit-only Gradle diagnostic skill.

## Catalogs And Plugin Ownership

- Keep external dependency and plugin versions in the owning version catalog.
  Use generated `libs` accessors in build scripts where supported; do not copy
  coordinates/versions into module scripts, `extra`, or parallel constants.
  Core Gradle plugins and local convention plugin IDs need no catalog version.
- Catalog aliases provide type-safe lookup, not dependency alignment, locking,
  or compatibility proof. Use platforms/constraints and dependency locking when
  those are the actual requirements; inspect the resolved graph.
  Before coding against a new or upgraded dependency, inspect the resolved
  version's API/source or version-matched documentation. A valid catalog entry
  does not make an older remembered API available.
- Inspect settings, plugin management, included builds, and build-logic
  dependencies before applying a plugin. Reuse the existing convention build;
  prefer an included `build-logic` build for new shared conventions. Do not move
  working `buildSrc` solely for fashion or create a second policy owner.
- Included builds and `buildSrc` do not inherit the root catalog automatically.
  Import the authoritative catalog explicitly in each build that needs it.
  Avoid importing `libs` twice where Gradle already supplies it automatically.
- Do not assume `alias(libs.plugins.x)` works inside a precompiled script
  plugin's `plugins` block. Declare the external plugin artifact/marker as a
  build-logic implementation dependency using the catalog-backed version, then
  apply its ID in the convention. Use the pinned Gradle version's supported
  catalog API inside plugin implementation code; dynamic `findLibrary` lookup
  is not a generated accessor and must diagnose missing entries.
- Own reusable toolchains, compiler options, test conventions, and architecture
  gates in focused convention plugins. Apply each external plugin in one clear
  place. Use `pluginManager.withPlugin` for plugin-dependent configuration and
  typed extensions rather than ordering assumptions, `afterEvaluate`, or root
  `allprojects`/`subprojects` mutation.
- Settings is the authority for module groups, boundary owners, repositories,
  and allowed dependency direction. Use `implementation` unless consumers need
  a dependency's public types; `api` is a deliberate contract and invalidation
  decision. Build logic must not become a product dependency.
- Derive source sets from Gradle's model, not existing directories. Plugins may
  declare source directories that do not exist yet or contain no files. Preserve
  that legal empty state; distinguish it from a failed model import or a missing
  required generator output. Do not invalidate the workspace merely for absence.
- A convention must enforce a durable build or domain contract. Do not add
  receipt files, stage-count gates, or task-order scaffolding solely to supervise
  an agent. Each check needs a concrete invalid fixture it rejects and a valid
  control it accepts; use existing lifecycle tasks rather than a parallel graph.

## Declare Work As A Graph

- Register tasks lazily with `tasks.register`, `named`, and `configureEach`.
  Keep `Provider`/`Property` chains lazy; do not call `get()` during configuration
  merely to extract a path or value.
- Declare every semantic input, output, tool version, option, and relevant
  environment value. Use appropriate path sensitivity. Each generated output
  directory has one owner; never write generated files into authored source.
- Connect consumers to producer output providers, including generated source
  directories. Provider wiring carries task dependencies. A hard-coded output
  path plus `mustRunAfter` does not: ordering does not schedule the producer.
  Explicit `dependsOn` is for real dependencies not expressible through data.
- Do not resolve configurations, run processes, scan source trees, or perform
  network IO eagerly during configuration. Use task actions, declared providers,
  or supported value sources as appropriate. Task actions must not capture
  `Project` or mutable configuration state that breaks configuration-cache reuse.
- Cache only deterministic tasks with complete declared inputs and outputs.
  `@CacheableTask` does not make a task correct. Up-to-date checks, build-cache
  reuse, configuration-cache reuse, and incremental processing within an
  executed task are different claims and need separate evidence.
- For incremental generators, handle changed, added, and removed inputs and
  a non-incremental fallback. Remove stale owned outputs; do not delete another
  task's outputs. Do not disable caches or add `clean` to hide stale output bugs.

## Prove The Affected Graph

Keep one change small enough to validate through its producer, owner, and direct
consumers. Implement a complete behavior slice rather than many unconnected
modules followed by one late aggregate build. Identify expected affected tasks
and at least one unrelated control module before running the experiment.

For a task/generator or shared convention change, use the pinned wrapper and
Gradle TestKit or the repository's existing functional harness:

| Scenario | Required observation |
| --- | --- |
| First execution | Correct output contents and required producer tasks run |
| Identical rerun | Eligible tasks are `UP-TO-DATE` or reused; outputs stay correct |
| Implementation-only edit | Owning work updates; unrelated work stays untouched; explain downstream invalidation from reports |
| Public ABI edit | Affected consumers recompile/check; unrelated modules remain controls |
| Generator input add/change/remove | Outputs match the new inputs; removed inputs leave no stale generated output |
| Configuration-cache rerun | Cache entry is actually reused, not merely stored |

Run only scenarios affected by the change. For ABI experiments choose a real
public signature change, not a private body edit; inline functions and constants
can affect consumers even without an ordinary signature change. Compare task
outcomes and output contents, not just elapsed time or exit status. A dry-run
describes scheduling, not execution or correctness. A clean build alone cannot
prove any incremental property. If build-cache reuse is claimed, test that
separately with controlled cache state and restored output contents.

For module boundary conventions, include missing/duplicate boundary ownership,
forbidden edges, and a newly added project that attempts to bypass the gate.
Use the Kotlin design skill's boundary-enforcement reference for resolved-type
fixtures. A regex lint or passing TestKit plugin-application test does not prove
nullable/primitive rejection.

## Authoritative References

Use version-matched documentation for the wrapper under test:

- [Version catalogs](https://docs.gradle.org/current/userguide/version_catalogs.html), including buildSrc imports and precompiled plugin limitations.
- [Convention plugins](https://docs.gradle.org/current/userguide/implementing_gradle_plugins_convention.html).
- [Lazy configuration](https://docs.gradle.org/current/userguide/lazy_configuration.html) and producer/consumer providers.
- [Incremental builds](https://docs.gradle.org/current/userguide/incremental_build.html) and declared inputs/outputs.
- [Incremental tasks](https://docs.gradle.org/current/userguide/custom_tasks.html#incremental_tasks) and removal handling.
- [Configuration-cache requirements](https://docs.gradle.org/current/userguide/configuration_cache_requirements.html).
- [TestKit](https://docs.gradle.org/current/userguide/test_kit.html).
