---
mode: agent
description: Bootstrap AGENTS.md navigation summaries for this repository (root + one level deep).
tools: ['codebase']
---

Bootstrap codebase navigation for this repository.

1. Generate `AGENTS.md` for the repo root.
2. List all immediate subdirectories (excluding `.git`, `node_modules`, `build`, `.gradle`,
   `.idea`, `__pycache__`, `dist`, `out`, `.venv`).
3. Generate `AGENTS.md` for each subdirectory.

For each directory, follow this process:
- List its contents.
- Read at most 5 files to infer purpose, in priority order:
  `README.md` > `SKILL.md` > `AGENT.md` > largest `.md` > primary source file.
- Compute a hash from the sorted immediate child names and regular-file sizes.
- If `AGENTS.md` already exists and its hash matches, mark as current and skip.
- Otherwise write the file using the standard format:

```
<!-- AGENTS.md: generated navigation; keep this file checked in -->
<!-- generated: <YYYY-MM-DD> | hash: <12-char hex> -->

# <directory-name>

## Purpose
<1-2 sentences>

## Key Files
- `name` — description
...

## Subdirectories
- [`name/`](name/AGENTS.md) — description
...

## Navigation Hints
- For <X>, see <Y>
```

After processing all directories, report:
- N written (new or updated)
- N current (hash matched, skipped)
- N excluded

Do not modify any source files. Only write `AGENTS.md` files.

Preserve authored `AGENTS.md` instructions; only refresh navigation carrying the generated
marker. Commit generated maps with the source change. Read `knowledge/index.md` when
present and preserve the root engineering rules. A shallow hash is only a routing hint.
