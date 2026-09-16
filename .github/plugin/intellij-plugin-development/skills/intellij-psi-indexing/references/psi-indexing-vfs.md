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
