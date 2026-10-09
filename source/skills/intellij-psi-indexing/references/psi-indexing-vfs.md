# PSI, Patterns, VFS, and Indexing

## PSI and Performance

PSI getters can traverse trees and allocate. Store repeated results locally;
prefer `textMatches()` or `textLength` when full text/range is unnecessary.
Avoid retaining ASTs or documents for unopened files. Use stubs, indexes, or a
gist when the query shape permits it. Cache expensive resolve/type/control-flow
work only with dependencies that invalidate on every fact the result uses.
When cached data depends on indexes, include dumb-mode changes where required.

Use `AstLoadingFilter` or test assertions to prove a code path does not load
unexpected ASTs. Measure a concrete action before and after; do not infer a
speedup from fewer lines of code.

Admit the subject, authority, scope, and current budget before optional expensive
preparation. Construct retained state lazily on the first eligible lookup; avoid
enumeration or hashing before a lookup that can reject or hit existing evidence.
Distinguish bounded detached data from live compiler/PSI objects. Positive reuse
belongs to an explicit read lifetime and authoritative dependency identity.
Negative memoization retains its finite cause and universe; it must not disable
an independent universe or survive beyond its declared lifetime.

Close providers on return, failure, cancellation, and native read retries. A new
native attempt recaptures its own inputs. Recheck current budget and authority
even on hits, and prevent stale or late results from publication. Prove zero
preparation for rejected requests, lazy first capture, eligible reuse, changed
dependency invalidation, independent rejected universes, fresh attempts, and
idempotent close with focused production-boundary tests. Measure native behavior
separately from fixture work counts.

These lifetime boundaries are illustrated by merged public
[Kast #961](https://github.com/amichne/kast/pull/961),
[#965](https://github.com/amichne/kast/pull/965), and
[#966](https://github.com/amichne/kast/pull/966). The
[read partition tests](https://github.com/amichne/kast/blob/5713978aab5d43c5b5ddb63cc8b6008f0fc27659/runtime/hosted/src/test/kotlin/io/github/amichne/kast/runtime/hosted/HostedReadCallbackPartitionsTest.kt)
exercise lazy capture, original model identity, current-parent rejection, fresh
attempts, and closure. They do not qualify native performance.

## Element Patterns

Compose high-level `PlatformPatterns`, `PsiElementPattern`, and language-owned
patterns. Test the expected parent/leaf/file shape plus close false positives.
When debugging, inspect PSI first, then condition the `ElementPattern.accepts`
breakpoint to the identifiable pattern rather than stopping on every match.

## Virtual Files

A `VirtualFile` is VFS identity, not necessarily a local disk file. Check
validity, use platform lookup APIs, and refresh only when an external write must
be observed. Traverse with `VfsUtilCore.iterateChildrenRecursively` to avoid
symlink cycles. Do not assume a PSI file always has a `VirtualFile`.

## File-Based Indexes

- Register a `FileBasedIndexExtension` under `com.intellij.fileBasedIndex`.
- Derive the map only from supplied `FileContent`; external dependencies cause
  stale entries.
- Use a unique fully qualified index ID, deterministic descriptors and
  externalizers, correct value equality, a narrow input filter, and an index
  version that changes with incompatible storage semantics.
- Prefer standard indexes and `PsiSearchHelper` where they already model the
  query. Use a scalar/single-entry index when that is the actual value shape.
- Collect from one index before consulting another; do not build logic around
  nested access that can deadlock or remain unsupported.

## First-Party Sources

Synthesized from JetBrains SDK documentation audited at
`JetBrains/intellij-sdk-docs@14ecf08ee392d9f42c0f4aadc5aafa911f156e22`:
[file-based indexes](https://plugins.jetbrains.com/docs/intellij/file-based-indexes.html),
[element patterns](https://plugins.jetbrains.com/docs/intellij/element-patterns.html),
[PSI performance](https://plugins.jetbrains.com/docs/intellij/psi-performance.html),
and [virtual files](https://plugins.jetbrains.com/docs/intellij/virtual-file.html).
