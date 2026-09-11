---
mode: agent
description: Regenerate AGENTS.md for a specific directory. Provide the directory path when invoking.
tools: ['codebase']
---

Regenerate `AGENTS.md` for the directory: ${input:directory:Directory path relative to repo root (e.g. src/main/kotlin)}

Steps:
1. List the contents of `${input:directory}`.
2. Read at most 5 files to infer purpose — priority: `README.md` > `SKILL.md` > `AGENT.md` > largest `.md` > primary source file.
3. List any immediate subdirectories (excluding `.git`, `node_modules`, `build`, `.gradle`, `dist`).
4. Compute a hash from sorted immediate child names and regular-file sizes.
5. Write `${input:directory}/AGENTS.md` using the standard format:

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

Report what was written and confirm the hash.
Do not modify any source files.

Preserve authored `AGENTS.md` instructions; only refresh navigation carrying the generated
marker. Commit generated maps with the source change. Read `knowledge/index.md` when
present and preserve the root engineering rules. A shallow hash is only a routing hint.
