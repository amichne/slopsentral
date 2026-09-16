# Local Summary Contract

Use this reference when designing or reviewing `AGENTS.md` or an
equivalent local navigation summary.

## Default Shape

```markdown
<!-- AGENTS.md: generated navigation; keep this file checked in -->
<!-- generated: <ISO date> | hash: <short hash> -->

# <directory name>

## Purpose
<one or two sentences>

## Key Files
- `file` - why an agent would open it

## Subdirectories
- [`dir/`](dir/AGENTS.md) - why an agent would enter it

## Entry Points
<public commands, APIs, manifests, or owning files when relevant>

## Navigation Hints
- For <task>, start with <path>.
```

## Required Properties

- Checked-in generated artifact: generated files are tracked and carry the
  marker above; authored `AGENTS.md` files remain authoritative.
- Deterministic enough to compare against current directory state.
- Short enough to scan before opening source files.
- Focused on routing: purpose, key files, subdirectories, entry points, and
  next-read hints.

## Exclusions

Exclude `.git`, dependency directories, build outputs, virtual environments,
IDE metadata, local summary files, staleness markers, binary caches, and other
directories that are not useful routing inputs.

## Hash Guidance

Use a cheap fingerprint when the summary is a local cache:

- sort included child names;
- include regular-file sizes; exclude mtimes and directory sizes for checkout stability;
- ignore the summary file itself;
- keep the hash short but stable enough to detect stale summaries.

Use content hashes only when the repository needs stronger drift detection and
the cost is acceptable.

Exclude build outputs, but retain a source module named `build` when it owns
`build.gradle.kts`. Link subdirectories to existing guides or to the directory
itself; do not manufacture links to absent `AGENTS.md` files.
