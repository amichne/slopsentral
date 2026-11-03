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

## Diagnose cache health

Record dependency transport, configuration-cache reuse, task-output reuse, and artifact downloads separately.
Count eligible tasks and expected hits in the same workload.
For an unexpected miss, compare the first changed input and the cache write policy.
For a false hit, stop writes from the affected task and isolate the suspect entries before another consumer restores them.
Restore normal use after the fresh-build comparison passes.

Record restore and save time as well as avoided task time.
An unchanged workspace can return `UP-TO-DATE` without a restore.
If scan evidence is missing, report cache health as unavailable.
Keep cold and warm samples separate. [Gradle cache diagnosis](https://docs.gradle.org/current/userguide/build_cache_debugging.html)
