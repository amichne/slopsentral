---
type: workflow
title: Maintain documentation and glossaries
description: Use the external OpenWiki integration for native OKF and Claims updates, reuse or bootstrap a source-backed glossary, and configure review-only documentation PRs.
tags: [documentation, openwiki, okf, glossary, automation]
sources:
  - id: openwiki-source-6d4b4e707b8d60b6ccfa3425
    resource: repo://.github/workflows/openwiki-update.yml
  - id: openwiki-source-77749248b9076e3dac86353b
    resource: repo://docs/glossary.json
  - id: openwiki-source-62bf20b2fca146abb9011c20
    resource: repo://source/skills/code-knowledge-base/references/knowledge-backend-handoff.md
  - id: openwiki-source-5aeb8b8adffe48c4411461e5
    resource: repo://source/skills/controlled-technical-writing/references/glossary-authoring.md
generated: { by: "amp", at: "2026-10-26T11:32:19.597Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-10-26T11:35:00.921Z
---

# Maintain documentation and glossaries

Use the Repository Knowledge plugin for source-backed documentation work.
`technical-documentation` owns document structure, `code-knowledge-base` owns
the backend handoff, and `controlled-technical-writing` owns terminology and
prose checks. The external `openwiki` integration owns this wiki's run state,
page assignments, Claims, indexes, and finalization.

## Reuse the glossary before drafting

This repository already has `docs/glossary.json` and its generated
[reader view](../../docs/GLOSSARY.md). The controlled scope includes
`openwiki/**/*.md`. Do not create another glossary merely because the backend
changes. Definitions remain provisional until source evidence and independent
reader review support adoption.

For an authorized generation, rewrite, or migration in a repository without a
glossary, first search its writing rules, documentation roots, and knowledge
configuration. Reuse an existing JSON or Markdown owner if found. Otherwise,
create the smallest source-backed provisional glossary before the page queue.
Default to `docs/glossary.json` and generated `docs/GLOSSARY.md` only when no
local convention supplies another location.

Keep source locations, examined domain references, examples, and distinctions.
Keep unsupported terms as gaps; do not invent definitions or replacement rules.
If no entries have enough evidence, continue supported documentation work
and report terminology coverage as `INCOMPLETE`. Reading, assessment alone,
ordinary code changes, and small wording edits do not trigger glossary creation.
The [authoring procedure](../../source/skills/controlled-technical-writing/references/glossary-authoring.md)
defines the evidence and review requirements.

## Complete the native OpenWiki lifecycle

Resolve the absolute Git top-level and use the external integration:

1. Begin an `init` or `update` run; resume its durable state if one exists.
2. If planning is required, map the relevant systems and submit a source-backed
   page plan with useful related pages. A no-op needs no page work.
3. Consume one assigned page at a time. Research current source, write that
   page with OKF frontmatter, and submit material Claims with bounded `repo://`
   evidence. Recheck stale Claims and preserve unchanged Claim identities.
4. Continue the queue, then call finish. Report completion only when native
   finalization returns `complete`.

Do not change executable source during generation, write unassigned pages,
or directly edit Claims, indexes, provenance, or run metadata. The standalone
OKF checker is not a substitute for native submission. Source drift requires
the integration's replan path. Keep glossary setup outside the managed queue.

## Review-only GitHub Action

[Update Repository Documentation](../../.github/workflows/openwiki-update.yml)
runs on relevant pushes to `main`, manual dispatch on `main`, and daily at
09:17 UTC. It checks out trusted main source with full history and no persisted
checkout credentials. Concurrent update jobs are serialized. It pins OpenWiki
0.6.1 and model `gpt-5.6-terra`, then runs `openwiki code --update --print`.

A maintainer must configure these repository Actions secrets before use:

| Secret | Purpose and scope |
| --- | --- |
| `OPENAI_API_KEY` | Authenticate the OpenAI model used for generation. The selected model must be available to this credential. |
| `OPENWIKI_PR_TOKEN` | A separate repository-scoped token with Contents and Pull requests write permissions for `amichne/slopsentral`. |

Use GitHub's private secret-entry interface. Never put credential values in
source, issues, wiki pages, or an agent conversation. Do not reuse generation
credentials as the PR token. The workflow fails before generation when either
secret is absent. Model generation processes repository content through the
configured provider; `.openwikiignore` excludes consumer trees, local caches,
dependencies, and environment files. Review exclusions before adding sensitive
source material; the ignore list is not a general secret scanner.

The built-in workflow token has read-only contents permission. The generation
process does not receive the PR token. Successful generation and glossary checks
must precede the PR step. It proposes only `openwiki/` changes, excluding transient
`.run.json` and authored `INSTRUCTIONS.md`, on `openwiki/update`. It does not
auto-merge, deploy, or publish executable source changes. Generated wiki-only
merges are outside its push-path filter, avoiding a self-triggered update loop.

The PR step runs only when generated pages, indexes, or Claims change. Native
no-ops can refresh `.last-update.json` and `.page-manifest.json`; those files
alone do not select a PR. Both remain included when substantive changes do
select a PR. The check covers staged, unstaged, new, and deleted generated files
without discarding native state.

## Validation and recovery

The action validates the glossary and reader-view freshness before generation,
then checks terminology in the wiki. Locally, run those same checks:

```sh
uv run --locked --script source/skills/controlled-technical-writing/scripts/check_glossary.py docs/glossary.json --check-render docs/GLOSSARY.md
uv run --locked --script source/skills/controlled-technical-writing/scripts/check_glossary.py docs/glossary.json openwiki
```

Before proposing a PR, the action also requires native metadata status
`complete` and no active `.run.json`. OpenWiki 0.6.1 can exit zero after skipping
a failed page while leaving status `interrupted`. A successful process exit
alone is therefore not enough to admit documentation changes.

These checks establish structure and configured terminology rules, not that
every definition or page is semantically correct. Check source citations and
links, and apply the pinned local Vale assessment when selected. Keep reports
separate from human comprehension evidence.

For missing credentials or model access, correct the private configuration
before retrying. For generation failure, inspect native lifecycle evidence and
resume through OpenWiki rather than editing its sidecars. Review PR citations
and scope before merging. A locally validated workflow is not evidence of a
successful Actions run or configured secrets; that needs the actual main run.
No remote enablement or publication follows from a local documentation edit.
