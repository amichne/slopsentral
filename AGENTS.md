# Repository Instructions

Slopsentral is the authored source for a plugin marketplace: skills, agents, hooks,
instructions, concepts, profiles, evals, and schemas under `source/`, plus the
tooling under `tools/` that validates and projects them for each host.

## Always

- Edit authored source. `.agents/plugins`, `.github/plugin`, `docs/public`,
  `openwiki`, and installed caches are generated; change their owner and
  regenerate them.
- Extend the existing owner when it meets the contract. Add an owner only for a
  responsibility no current owner can serve.
- Preserve the user's authorization and unrelated work. Source inspection does
  not establish installation, publication, native loading, or model behavior.

## Route by the change

Read only the rows that match the work, before acting. Reconsider when the work
moves to another row.

| When the change affects | Read |
| --- | --- |
| Skills, agents, hooks, plugins, profiles, resources, or the catalogs | [Source graph](guidance/source-graph.md) |
| Provider projection, Pkl runtime, or generated provider output | [Projection](docs/pkl-projection.md) |
| Native command installation, updates, removal, or setup receipts | [Command installation](docs/cli-install.md#maintainer-change-contract) |
| Pi bootstrap, packages, native hooks, or recovery | [Pi installation](docs/pi-install.md#maintainer-change-contract) |
| Versions, release admission, or promotion of retained artifacts | [Releases](docs/releases.md) |
| Decision cases, graders, routing fixtures, or execution scenarios | [Evaluations](docs/skill-evals.md) |
| Explanations, coverage, glossary, or knowledge freshness | [Documentation](docs/documentation.md) |
| Website projection or an authorized deployment | [Site](docs/mintlify.md) |
| Shared session instructions or the portable global file | [Global instructions](docs/global-agents.md) |
| Native instruction scope or maintenance hooks | [Scoped instructions](docs/agents-md-scope.md) |
| Portable concepts under `source/concepts` | [Concept instructions](source/concepts/AGENTS.md) |

To apply one of this repository's procedures to the work itself, such as TDD or
Python tooling, select it in the [task catalog](source/CATALOG.md).

## Before handoff

Run the checks for the changed surface listed in [verification](guidance/verification.md).
Report each as passed, failed, skipped, or not run.

<!-- OPENWIKI:START -->

## OpenWiki

This repository has a generated `openwiki/` evidence index. It is optional just-in-time context, not required startup reading.

- Do not enumerate, preload, or search wikis at task start. Use retrieval when the user asks for it, when unfamiliar architecture or dependency behavior materially affects the task, or when source inspection leaves an important uncertainty. Stop once the question is grounded.
- When those conditions apply and OpenWiki retrieval tools are available, use `openwiki_search` for just-in-time context and `openwiki_read` for the relevant complete sections. If search returns `workspace_required`, ask which listed workspace to use and retry with its ID.
- Use `openwiki_list_workspaces` or `openwiki_list_wikis` when workspace membership itself needs to be discovered.
- If the retrieval tools are unavailable, read `openwiki/quickstart.md` and follow its links to the relevant pages.
- Treat source code and tests as authoritative. A brief's unknowns and review items are verification gaps, not automatic requirements.
- Prefer the narrowest quiet validation that proves the changed behavior. Preserve complete failure output.

Use the repository's documented maintenance process to refresh generated pages after source changes. Check its configuration and completed runs before relying on automatic updates. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->
