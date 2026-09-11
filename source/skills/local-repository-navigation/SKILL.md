---
name: "local-repository-navigation"
description: "Use when explicitly asked to create or refresh checked-in AGENTS.md navigation summaries or OUTDATED.local.md markers."
---

# Local Repository Navigation

Use this skill to create checked-in, generated navigation maps that help agents choose
where to read next. These maps are routing aids, not source-of-truth docs.

## Operating Contract

- Keep durable repo instructions and generated navigation in checked-in
  `AGENTS.md` files; generated files carry an explicit marker.
- Never overwrite an authored `AGENTS.md`; refresh only files carrying the
  generated navigation marker.
- Make generated summaries deterministic enough to skip unchanged directories.
- Read just enough source to orient the summary. Do not turn navigation refresh
  into full documentation authoring.
- Keep any staleness marker append-only for hooks and truncate-only for the
  refresh workflow.
- Never mutate source files as part of navigation refresh.
- Route through `knowledge/index.md` when present; Code Knowledge Base owns
  source-bound concept docs and impact checks. Engineering Baseline owns durable
  invariant rules. Generated maps add navigation, never replace either authority.

## Workflow

1. Choose the local artifact.
   Name the summary file and where it lives. Use
   [summary-contract.md](references/summary-contract.md) for the default
   `AGENTS.md` contract.

2. Define exclusions.
   Exclude VCS metadata, dependency caches, build outputs, virtual
   environments, generated local summaries, and staleness marker files.

3. Generate a summary.
   List the directory, read at most a few representative files, infer purpose,
   record key files and subdirectories, and write a compact map.

4. Detect staleness cheaply.
   Use sorted immediate child names and regular-file sizes, excluding mtimes
   and directory sizes. Source-change markers still require review when the hash matches.
   Prefer a stable hash over re-reading every file.

5. Refresh only what changed.
   When a marker such as `OUTDATED.local.md` exists, process each listed path,
   refresh the matching local summaries, and clear the marker only after the
   refresh succeeds. See [staleness-workflow.md](references/staleness-workflow.md).

## Completion Criteria

- Generated navigation files are explicitly generated and checked in.
- The summary contract states required sections, exclusions, and hash behavior.
- Refresh work is bounded to changed or requested directories.
- Hooks or scripts never edit source files while maintaining navigation.
- The result helps choose source reads; it is not a substitute for reading code
  when implementation details matter.
