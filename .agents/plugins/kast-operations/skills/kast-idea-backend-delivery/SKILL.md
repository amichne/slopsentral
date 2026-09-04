---
name: kast-idea-backend-delivery
description: Use when working only on Kast's backend-idea plugin lifecycle, exact-root IDEA readiness, mixed-language PSI reference indexing, development installation, unsigned ZIP ownership, or IDEA backend delivery evidence.
---

# Kast IDEA Backend Delivery

Live Kast repository instructions, CLI help, build files, and workflow state
override remembered commands.

## Workflow

1. Read root and `backend-idea/AGENTS.md`, inspect status, and preserve unrelated
   work. Use an isolated clean worktree when needed for trustworthy proof.
2. Inspect `backend-idea/build.gradle.kts`, `plugin.xml`, the version catalog,
   wrapper, and consuming release workflows before changing versions or tasks.
3. From the canonical workspace root, use current public `kast` help and
   `kast up` to establish exact-root semantic readiness. Preserve typed
   readiness or version blockers; do not route through or manipulate a
   foreground IDE to manufacture success.
4. For reference indexing, narrow resolved targets to the required Kotlin PSI
   type before language-specific paths, offsets, or ranges. Skip unsupported
   languages without aborting later valid references. Fix the shared scanner.
5. Run focused `:backend-idea:test` proof, then `:backend-idea:buildPlugin` when
   the ZIP or installation path changes.

## Ownership

`backend-idea` owns its tests and unsigned plugin ZIP. Repository-level release
workflows own signing, update-feed generation, publication, and channel policy.
A built ZIP is not installed or active proof. Use the repository's supported
development-machine reconcile path only when installation validation is
requested; then reopen the exact root and establish fresh readiness before
claiming activation.

For Git, PR, CI, or release work, verify the exact head SHA and terminal remote
job/artifact state. Keep build, installation, activation, and publication as
separate evidence stages.
