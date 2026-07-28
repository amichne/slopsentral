# Kast IDEA Backend Delivery

Load this reference only for the Kast repository. Live repository instructions,
CLI help, build files, and workflow state override remembered commands.

## Authority and Worktree Safety

1. Read the root instructions and `backend-idea/AGENTS.md`.
2. Inspect `git status --short --branch` and relevant diffs. Preserve unrelated
   dirty work; use an isolated clean worktree when it prevents trustworthy
   RED/GREEN evidence.
3. Read `backend-idea/build.gradle.kts`, its `plugin.xml`, the version catalog,
   wrapper, and consuming release workflows before changing versions or tasks.
4. Keep generated provider output and installed plugin caches out of source
   edits.

## Exact-Root Semantic Readiness

Resolve and pass the canonical root explicitly:

```sh
repo_root=$(git rev-parse --show-toplevel)
kast context --workspace-root "$repo_root" --backend idea --output toon
kast ready --workspace-root "$repo_root" --backend idea --for kotlin --output toon
kast agent --help
```

Use Kast semantic commands only after readiness succeeds. On macOS, do not
replace a typed IDEA-backend blocker with unsupported headless analysis.
`RUNTIME_TIMEOUT`, `SEMANTIC_WORKSPACE_UNPREPARED`,
`IDEA_PLUGIN_UPDATE_REQUIRED`, `UnsupportedReleasePair`, and restart-required
results preserve useful state; report or resolve them through the supported
IDEA lifecycle.

## PSI Reference Indexing

Kast phase-two reference indexing flows through `IdeaProjectIndexer` into the
shared `PsiReferenceScanner`; the indexer persists admitted rows. A resolved
reference can target Java, Scala, generated, or other non-Kotlin PSI.

- Cast or filter the resolved target to `KtNamedDeclaration` before accessing
  Kotlin-specific paths, offsets, or `textRange`.
- Keep declaration identity offsets Kotlin-specific.
- Skip irrelevant targets without aborting later valid Kotlin references.
- Fix the shared scanner boundary once instead of adding caller-specific
  guards.

Focused regression proof:

```sh
./gradlew :backend-idea:test \
  --tests 'io.github.amichne.kast.idea.IdeaReferenceIndexEnvironmentTest'
```

The regression must prove a non-Kotlin target emits no row and later Kotlin
references still index.

## Plugin and Runtime Proof

- Run affected `:backend-idea:test` targets first and broaden according to
  `backend-idea/AGENTS.md`.
- Run `./gradlew :backend-idea:buildPlugin` when the ZIP or installation path
  changes.
- `backend-idea` owns the unsigned ZIP. Do not add Marketplace publishing,
  certificate properties, signing, or signature-verifier staging there;
  release workflows and the update feed own distribution.
- Use `./gradlew refreshDevelopmentMachine --console=plain` only when local
  installation validation is requested. A built ZIP is not installed proof.
- Replace the live IDEA plugin only through the supported stopped-IDE
  reconcile/setup path. Reopen the exact checkout, wait for fresh metadata,
  and re-run readiness before claiming the new plugin is active.

## Delivery

Use narrow staging and preserve unrelated work. For PR, CI, or release work,
verify the exact head SHA and terminal job/artifact state. Keep Linux release
bundle execution and native macOS setup verification as separate platform
proofs.
