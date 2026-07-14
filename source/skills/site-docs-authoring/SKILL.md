---
name: "site-docs-authoring"
description: "Author evidence-led technical documentation sites built with Zensical, MkDocs, or Material-style Markdown. Use when work spans site configuration, navigation, generated-doc boundaries, rendered features, or source-backed examples and references."
---

# Site Docs Authoring

Use this skill when the work is not just a single document, but part of a
documentation site. A site change is complete only when its authored source,
navigation, examples, and rendered output agree.

## Operating Contract

- Treat the docs site as a source-of-truth surface, not a prose dump.
- Read the local docs config before choosing structure: `zensical.toml`,
  `mkdocs.yml`, `mkdocs.yaml`, `docs/AGENTS.md`, and nearby page patterns.
- Preserve the current site dialect unless the user explicitly asks to migrate.
- Do not hand-edit generated reference pages; find and update the generator or
  record the generated boundary.
- Make every borrowed example proof-carrying: record its source path,
  prerequisites, reader job, verification signal, and material caveat.
- Prefer executable defaults, schemas, parsers, and tests over prose examples.
  Treat an upstream guide as evidence to verify, not runtime proof.
- Do not assume a Material for MkDocs feature works in Zensical. Require local
  configuration, Zensical source evidence, and a rendered check.
- Keep primary rules in the main page and move long examples, variants, or
  background into linked reference pages.
- Use site features to improve comprehension: tabs for alternatives, grids for
  entry points, admonitions for side constraints, tables for lookup, and Mermaid
  for flow or structure.
- Ground claims in code, configs, command output, schema files, or documented
  decisions.

## Workflow

1. Map the site.
   Identify the config file, docs root, nav owner, theme features, Markdown
   extensions, generated directories, installed tool version, and validation
   commands. Complete when every edited surface has an identified source owner
   and proof command.

2. Define the reader path.
   Establish the page type, audience, intended reader action, source material,
   sibling pages, and whether the page belongs in existing navigation. Complete
   when the page has one explicit reader job and a discoverable place in the
   site.

3. Harvest evidence.
   When adding an example or renderer feature, search the local repository and
   the official source repository. Reconcile guide prose with executable
   defaults, parser behavior, tests, and the live CLI. Complete when each
   adopted example is proof-carrying; load [source-evidence.md](references/source-evidence.md)
   for the extraction method.

4. Match the house structure.
   Reuse the site's front matter, heading style, lead paragraphs, page cards,
   callouts, diagrams, examples, and link style. If the repo has docs
   instructions, follow them first. Complete when the draft fits adjacent pages
   without introducing an unconfigured dialect.

5. Draft or edit in place.
   Update Markdown, config, nav, assets, and cross-links as one change set.
   Keep headings task- or concept-oriented and put an orienting paragraph after
   each major heading before lists or subheadings. Complete when every new page,
   link, nav entry, and prerequisite config change is present in authored source.

6. Verify the render.
   Run the repo's docs build when nav, config, theme features, links, or
   generated pages changed. Inspect the target generated HTML when a Markdown
   feature could pass through literally. Use only flags supported by the live
   CLI or repo wrapper. Complete when the build passes and each changed visual
   feature has a rendered signal, or the exact residual blocker is recorded.

## Reference Routing

- Load [source-evidence.md](references/source-evidence.md) when importing or
  refreshing examples, adopting an advanced renderer feature, or building a
  source-backed reference.
- Load [zensical.md](references/zensical.md) when the site uses
  `zensical.toml` or Zensical-specific page features.
- Load [mkdocs.md](references/mkdocs.md) when the site uses `mkdocs.yml` or
  Material for MkDocs directly.
- Load [page-structures.md](references/page-structures.md) when creating a new
  page, reorganizing navigation, or changing the reader journey.
- Load [prose-structure.md](references/prose-structure.md) when the request is
  mainly about style consistency, agent-readable reference material, or
  preserving a site's prose shape.

## Completion Criteria

- The page has an explicit reader job and fits the surrounding nav.
- Site config and nav are updated when discoverability changes.
- Generated docs boundaries are respected.
- Every adopted example carries provenance, prerequisites, purpose, a rendered
  verification signal, and relevant limitations.
- Material-style syntax is used only when the active site dialect proves it.
- The relevant docs build or validation command passed, or the residual blocker
  is stated.
