<!-- codebase-navigator snippet — paste into .github/copilot-instructions.md -->

## Codebase Navigation

This repository uses `AGENTS.md` files for AI-readable directory summaries.
Generated navigation files are checked in. Authored AGENTS.md instructions are preserved.

**When navigating the codebase:**
- Before globbing or reading source files in a directory, check for `AGENTS.md` there first.
- Use summaries for orientation; source, schemas, compiler evidence, and tests remain authoritative.
- If `knowledge/index.md` exists, choose a source-bound concept there before broad source reads.
- If `AGENTS.md` is missing for a directory you need to understand, say so — the user
  can regenerate it with: `@codebase-navigator update this directory`.

**When `OUTDATED.local.md` exists at the repo root:**
- Flag it to the user at the start of the session.
- Offer to process it: `@codebase-navigator process outdated`.

Commit generated `AGENTS.md` files with the repository changes. Keep
`OUTDATED.local.md` machine-local.
