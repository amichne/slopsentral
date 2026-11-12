# Branch Preservation

A guard requires a language version that supports it. Verify the repository's
language setting, not just a locally installed compiler.

```kotlin
sealed interface CacheRead<out T : Any> {
    data class Hit<T : Any>(val value: T, val expired: Boolean) : CacheRead<T>
    data object Miss : CacheRead<Nothing>
}

sealed interface CacheUse<out T : Any> {
    data class Available<T : Any>(val value: T) : CacheUse<T>
    data object Expired : CacheUse<Nothing>
    data object Missing : CacheUse<Nothing>
}

fun <T : Any> usableValue(read: CacheRead<T>): CacheUse<T> = when (read) {
    is CacheRead.Hit if !read.expired -> CacheUse.Available(read.value)
    is CacheRead.Hit -> CacheUse.Expired
    CacheRead.Miss -> CacheUse.Missing
}
```

The second `Hit` branch covers the guarded case's remainder. Removing it is not
an exhaustive match. Adding a new subtype should require reviewing this function.
For an older language version, keep the predicate inside the `Hit` branch.
`T : Any` excludes nullable contents; expiration and a cache miss retain distinct
meaning rather than collapsing into null. Callers supply their domain value type.

External strings remain open until parsed. A `when` on a wire string needs an
unknown-input branch; exhaustive handling belongs after parsing to a closed type.

A predicate may read time, consume input, or mutate state. Do not reorder it,
evaluate it twice, or lift it out of a branch without proving equivalent effects.
Replace `?: return` with an explicit value branch under the [expression-flow policy](expression-flow.md).
Preserve cleanup and commit or rollback behavior inside `use`, `try/finally`, and transactions.
Use behavior assertions for the affected cases instead of source-format assertions.
