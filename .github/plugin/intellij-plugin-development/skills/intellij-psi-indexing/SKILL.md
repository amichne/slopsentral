---
name: intellij-psi-indexing
description: Use when IntelliJ Platform work involves PSI traversal or resolve, element patterns, VFS identity and refresh, dumb mode, file-based indexes, stubs, gists, cached values, AST loading, or indexing performance.
---

# IntelliJ PSI and Indexing

Use `jbcontext search` once when the owning code location is unknown, inspect
the first relevant area, then switch to exact file and symbol reads. Do not
duplicate semantic discovery in a plugin script.

## Workflow

1. Identify whether the behavior belongs to PSI, VFS, a standard index, a
   custom file-based index, stubs, a gist, a cache, or an element pattern.
2. Inspect resolved Platform APIs and the repository's descriptor and tests.
3. Keep PSI/index reads inside short read actions and smart-mode constraints.
   Re-check validity after asynchronous boundaries; persist stable identities
   or smart pointers rather than long-lived raw PSI.
4. Narrow mixed-language resolved elements before language-specific access.
5. Make custom index input deterministic from `FileContent`, keep key/value
   serialization stable, and bump the index version for incompatible data.
6. Prove semantics with focused fixtures, then measure the named slow action.

Read [psi-indexing-vfs.md](references/psi-indexing-vfs.md) for design and
performance constraints.

## Completion

- Element patterns are narrow, composable, and tested against true and false
  PSI shapes.
- VFS code uses platform identity/refresh rules and avoids recursive loops.
- Index data is deterministic, dumb-mode access is explicit, and nested index
  access is not used as an implicit dependency protocol.
- Expensive PSI getters, resolve, AST/document loading, and cache dependencies
  have focused correctness and performance evidence.
