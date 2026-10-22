# Branch Preservation

A guard requires a language version that supports it. Verify the repository's
language setting, not just a locally installed compiler.

```kotlin
sealed interface CacheRead {
    data class Hit(val value: String, val expired: Boolean) : CacheRead
    data object Miss : CacheRead
}

fun usableValue(read: CacheRead): String? = when (read) {
    is CacheRead.Hit if !read.expired -> read.value
    is CacheRead.Hit -> null
    CacheRead.Miss -> null
}
```

The second `Hit` branch covers the guarded case's remainder. Removing it is not
an exhaustive match. Adding a new subtype should require reviewing this function.
For an older language version, keep the predicate inside the `Hit` branch.

External strings remain open until parsed. A `when` on a wire string needs an
unknown-input branch; exhaustive handling belongs after parsing to a closed type.

A predicate may read time, consume input, or mutate state. Do not reorder it,
evaluate it twice, or lift it out of a branch without proving equivalent effects.
Replace `?: return` with an explicit value branch under the [expression-flow policy](expression-flow.md).
Preserve cleanup and commit or rollback behavior inside `use`, `try/finally`, and transactions.
Use behavior assertions for the affected cases instead of source-format assertions.
