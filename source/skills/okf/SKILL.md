---
description: Create, read, maintain, and visualize Open Knowledge Format (OKF) bundles — directory trees of Markdown "concept" files with YAML frontmatter that link into a knowledge graph. Triggers on `/okf` (and `/okf init|update|query|validate|viz`). Use when asked to capture a project's knowledge as OKF, keep an okf/ bundle in sync after changes, navigate a bundle to answer a question, or when a folder of .md files carries a `type:` frontmatter field (the Google Cloud Open Knowledge Format).
metadata:
    github-path: okf
    github-ref: refs/heads/main
    github-repo: https://github.com/sniperunder123/okf-knowledge
    github-tree-sha: 1a0371a445eb6f73912bf3e74bb3a63dfe54b5ff
name: okf
---
# /okf — OKF Knowledge

Open Knowledge Format (OKF) is a vendor-neutral spec (Google Cloud, v0.1) for sharing
knowledge as plain Markdown. A **bundle** is a directory tree of files where each non-reserved
file is **one concept** (a table, a module, an endpoint, a metric, a runbook…) with YAML
frontmatter, and concepts link to each other to form a knowledge graph. No SDK, no runtime —
just git-versionable text.

This skill is **command-driven**: the user runs `/okf <subcommand>` and you follow the matching
flow below to build, sync, read, validate, or visualize a bundle.

## Usage

```
/okf                      # smart default: sync the okf/ bundle if it exists, else offer to init
/okf init [path]          # build a new OKF bundle from this project's code + docs
/okf update [path]        # sync the bundle with what changed; fix links, append log.md, validate
/okf query "<question>"   # answer by navigating the bundle, index-first (no full-file dumps)
/okf validate [path]      # run conformance + lint checks
/okf viz [path]           # (re)generate viz.html + graph.mmd
/okf add "<thing>"        # add one new concept and wire its links
```

Default bundle directory: **`okf/`** in the current project (override with `[path]`).

## What to do when invoked

1. Parse the subcommand (no subcommand → **smart default**: if `<project>/okf/` exists run
   `update`, otherwise propose `init`).
2. Resolve the bundle directory (arg, else `okf/`).
3. Run the matching flow below.
4. **Always finish by validating** and fixing every error:
   `python <skill-dir>/scripts/validate.py <bundle> --strict`
   (`<skill-dir>` = this SKILL.md's directory; `scripts/` and `resources/` are its siblings.
   Both `validate.py` and `visualize.py` need PyYAML — `pip install pyyaml`.)

---

## The format in one screen

- **A concept = one `.md` file.** Concept ID = its path within the bundle minus `.md`
  (`modules/openrouter-client.md` → `modules/openrouter-client`).
- **Frontmatter** is delimited by `---`. The **only required field is `type`** (a non-empty
  string). Recommended, in order: `title`, `description` (one sentence), `resource` (a URI),
  `tags` (YAML list), `timestamp` (ISO 8601 of the last meaningful change; a date like
  `2026-06-15` is fine).
- **Links** use ordinary Markdown and keep `.md`. Prefer **absolute, bundle-relative**:
  `[customers](/data/customers.md)`.
- **Reserved files at every level:** `index.md` (navigation / progressive disclosure) and
  `log.md` (chronological history, newest first). They carry **no `type`**. Only the
  bundle-root `index.md` may carry frontmatter, and only `okf_version: "0.1"`.
- **Conventional body headings:** use `# Schema` for structural/schema sections, `# Examples`
  for usage examples, and `# Citations` for externally-sourced facts (numbered; links or
  `references/` concepts). Other headings are free-form.
- **Links are untyped, directed relationships.** An ordinary Markdown link `[B](B.md)` in
  concept A means "A references B". No explicit edge labels or types are needed; the graph is
  implicit in the link structure.
- **Honesty:** never invent a `resource`, `timestamp`, or `description`; never create a broken
  link; one concept per file; keep every concept reachable from an `index.md`.

```yaml
---
type: BigQuery Table
title: Orders
description: One row per completed customer order.
resource: bigquery://acme/sales/orders
tags: [sales, orders]
timestamp: 2026-05-28
---
```

See `resources/example-bundle/` for a complete reference bundle.

---

## Flows

### `/okf init` — build a bundle

1. Inventory the **concepts**: one file per atomic unit (table/collection, endpoint, module,
   metric, playbook, system…). Choose a directory layout that fits the domain.
2. **Fix the full path list first** — this is what makes cross-links valid. For a large source,
   list every concept's path/type/title before writing bodies.
3. Write each concept: valid frontmatter + a faithful Markdown body distilled from the source
   (keep tables, code, key numbers; never invent). **Link** related concepts (absolute paths).
4. Add a root `index.md` declaring `okf_version: "0.1"` plus a per-directory `index.md`.
5. Start `log.md` with an `**Initialization**` entry.
6. Validate `--strict`; fix everything. Offer `/okf viz`.

For bulk import from a source of truth (DB schema, dbt manifest, OpenAPI, an existing doc),
map one concept per asset and **leave `description` empty rather than inventing it**.

### `/okf update` — sync after changes (the on-demand maintain)

This is the everyday command. Bring the bundle back in line with reality:

1. **Find what changed.** Prefer git: `git status` / `git diff` since the most recent date in
   `log.md` (or since the last commit). If git is unavailable, ask the user "what changed?".
2. **Map changes to concepts:** a new route → `endpoints/<x>.md`; a changed module →
   `modules/<y>.md`; a renamed file → rename its concept and update **every inbound link**
   (search the whole bundle for the old path).
3. Create/update the affected concept files; refresh each changed file's `timestamp`.
4. **Keep links valid** — but **never rewrite links inside historical `log.md` entries**
   (dangling history is expected and exempt from the link check).
5. Update the relevant `index.md` when concepts are added/removed/renamed.
6. Append a dated entry to `log.md` (newest first) with the right convention word
   (**Creation** / **Update** / **Removal** / **Fix** / **Deprecation**), linking the affected
   concept(s).
7. Validate `--strict`; fix; offer to refresh `viz`.

### `/okf query "<question>"` — read

1. **Start at the root `index.md`** (if absent, build a map from the tree + each file's
   frontmatter). Follow only the links relevant to the question — do **not** dump every file.
2. Use frontmatter (`type`, `tags`, `description`) as the quick-query layer; bodies for detail.
3. Check `log.md` for "what changed". Answer, citing the concepts you used by path.

### `/okf validate [path]`

Run `python <skill-dir>/scripts/validate.py <bundle> --strict`.

**Conformance errors** (always checked — failing any is a spec violation):
- Parseable YAML frontmatter on every concept file.
- Non-empty string `type` on every concept file.
- Reserved-file structure (`index.md` / `log.md` must not carry a `type`).

**Producer lints** (warnings, enabled by `--strict`): broken intra-bundle links, links missing
the `.md` extension, orphan concepts unreachable from any `index.md`, missing recommended fields
(`title`, `description`). These are **not spec violations** — they flag quality issues in the
*producer* (the tool generating the bundle). Consumers **must tolerate** bundles that have lint
warnings; they are never grounds to reject a bundle.

Report results; fix errors. Lint warnings should be fixed too, but they do not make a bundle
non-conformant.

### `/okf viz [path]`

Run `python <skill-dir>/scripts/visualize.py <bundle>` to (re)generate `viz.html` (interactive
graph) and `graph.mmd` (aggregated Mermaid). It reads the explicit concept links — no LLM.

### `/okf add "<thing>"`

Create one new concept file in the right directory with valid frontmatter, link it to/from
related concepts, add it to the directory `index.md`, log a `**Creation**` entry, validate.
