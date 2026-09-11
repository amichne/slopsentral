---
mode: agent
description: Process OUTDATED.local.md — regenerate AGENTS.md for all directories flagged as changed since last navigation update.
tools: ['codebase']
---

Process `OUTDATED.local.md` at the repo root.

1. Read `OUTDATED.local.md`. Each non-blank line is a directory path relative to the repo root.
   If the file does not exist or is empty, report "Nothing to update." and stop.

2. For each listed directory:
   - List its contents.
   - Read at most 5 files to infer purpose (priority: `README.md` > `SKILL.md` > `AGENT.md` > largest `.md` > primary source).
   - Compute a hash from sorted immediate child names and regular-file sizes.
   - Review the guide against source even if the shallow hash matches. Preserve authored
     instructions; rewrite only navigation carrying the generated marker.

3. Truncate `OUTDATED.local.md` only after every directory is successfully reviewed.
   Retain the marker if any directory is missing or any refresh fails.

4. Report: N updated, N failed (directory no longer exists).

Do not modify any source files. Only write `AGENTS.md` files and truncate `OUTDATED.local.md`.
