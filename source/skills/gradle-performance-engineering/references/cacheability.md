# Establish task cacheability

A cacheable task declares each input that affects its output.
The implementation and declared inputs must produce interchangeable outputs on the supported hosts.
Restoration must also satisfy downstream consumers.
A task that needs an external effect on each invocation must still run that effect on a cache hit.
Keep that effect in a separate task when its output can be cached independently. [Gradle cache concepts](https://docs.gradle.org/current/userguide/build_cache_concepts.html)

From this skill directory, run the controls with a pinned Gradle executable or an absolute repository wrapper path.

```sh
uv run --locked --script scripts/cacheability.py /absolute/path/to/gradle
```

The experiment uses a fresh project directory for each invocation.
The valid cases share one temporary Gradle user home. The deliberately broken task uses another.
The task has one output file. The experiment compares its complete contents.

| Case | Necessary result |
| --- | --- |
| Repeatability | Two separate cache-disabled builds produce the expected bytes. |
| Relocation | The producer seeds a fresh cache. Another directory restores `FROM-CACHE` and runs the consumer. |
| Invalidation | A flavor change executes the task. Its bytes match a fresh build with the same change. |
| False hit | The fixture omits the flavor input. A changed flavor restores stale bytes. The cache-disabled build produces the new flavor. |

A zero exit means that all four controls ran, including detection of the false hit.
Apply the same sequence to the actual task before a cacheability claim.
Include its entire output inventory, file modes where meaningful, and a real downstream consumer.
For a host-dependent task, record the JDK, target, linker, native flags, and metadata that affect its output.
A local relocation result covers only the hosts in the experiment.

## Choose a fingerprint for the consumer

For one edit at a time, answer two questions independently. Does Gradle change the key?
Does the task change its output in a fresh execution? A stable key with changed output permits a stale restore.
A changed key with identical output identifies work the declaration could avoid.

| Input declaration | What Gradle compares |
| --- | --- |
| Ordinary input files with path sensitivity | File contents, including raw archive bytes, plus the selected path information. Collection order does not enter the fingerprint. For individually supplied files, `RELATIVE` keeps the basename, as does `NAME_ONLY`. For a directory tree, `RELATIVE` keeps paths within that tree. |
| Runtime classpath | Ordered root fingerprints. Root names and locations, archive timestamps, and archive entry order do not contribute. Resource paths and contents generally do. Gradle compares parseable properties by key and value and manifest attributes without regard to name case or order. |
| Compile classpath | The Java compile ABI. Resource edits can leave the key unchanged. Exchanging roots with identical ABI fingerprints can also leave it unchanged. |

Inspect the task action as well as its annotation. A checksum, signature, or raw resource copier can observe bytes the runtime classpath discards.
A reader that selects the first matching resource observes order. An ordinary file collection can hide that dependency.
Moving an archive and renaming it are separate experiments when the output contains its basename.

Choose the narrowest declaration that preserves the consumer's result.
For an order-sensitive reader of raw files, declare the raw content and an ordered identity that binds each position to its content.
For a reader of one parsed value, consider declaring that value through a tracked provider.
Keep producer dependencies and exercise changes to consumed and ignored data in separate workspaces.
Check these rules against the [wrapper's input normalization semantics](https://docs.gradle.org/current/userguide/incremental_build.html).

## Diagnose cache health

Record dependency transport, configuration-cache reuse, task-output reuse, and artifact downloads separately.
Count eligible tasks and expected hits in the same workload.
For an unexpected miss, compare the first changed input and the cache write policy.
For a false hit, stop writes from the affected task and isolate the suspect entries before another consumer restores them.
Restore normal use after the fresh-build comparison passes.

Record restore and save time as well as avoided task time.
An unchanged workspace can return `UP-TO-DATE` without a restore.
If scans are unavailable, use invocation-specific native cache diagnostics for the fields they expose.
Keep cold and warm samples separate. [Gradle cache diagnosis](https://docs.gradle.org/current/userguide/build_cache_debugging.html)

## Trace one repeated task

Choose the first unexpected miss upstream of the expensive work. Compare the same task across two identified invocations.
Use a scan comparison or the wrapper's build-cache debug logging in a controlled run.
Keep the first differing property or implementation fingerprint. Avoid publishing raw debug logs.

- **Different keys.** Compare ordered classpaths, generated resources, implementation classpaths, and toolchains.
  If directory traversal supplies unordered JARs, define a stable relative-path order for that collection.
  Preserve intentional dependency precedence. Check shadowed classes and resources with the real consumer.
  For generated JARs, keep the producer dependency and lazy enumeration.
  Exercise an empty checkout through extraction and compilation, then repeat with configuration-cache reuse.
- **Revision metadata.** Identify every consumer affected by runtime classpath normalization.
  Ignore a specific property only when changes to its value preserve every affected result.
  Keep provenance in the shipped artifact. Vary only the revision, then vary a property that changes behavior.
  The first change must preserve the key. The second must invalidate it and match a fresh result.
- **Repeated transforms.** Hold the input archive and transform parameters fixed. Change one unrelated build convention.
  If the implementation fingerprint changes, isolate the transform and its dependencies from unrelated convention code.
  Repeat the edit and compare output paths and digests. Change an actual transform input to exercise invalidation.
- **Equal keys.** Find the producer's store outcome and the consumer's restore scope.
  In a clean workspace, look for `FROM-CACHE` on that task and exercise its downstream consumer.
  Matching keys alone establish key stability. If the writer or restore outcome is missing, record it as unknown.

Consult the wrapper version's rules for [classpath normalization](https://docs.gradle.org/current/userguide/incremental_build.html)
and [artifact transforms](https://docs.gradle.org/current/userguide/artifact_transforms.html).
