# Repository Instructions

## Authority and task selection

Read Slopsentral's [global engineering instructions](docs/examples/global/AGENTS.md)
first, then use the [task catalog](source/CATALOG.md) to select guidance for the
action you intend to take. Apply the [shared engineering baseline](source/instructions/engineering-design.md)
within its scope. Reuse verified reads at the selected revision.

Read a selected procedure before the decision or operation it governs. Reconsider
that selection when the task moves into another kind of work. A plugin makes
capabilities available; its dependency closure does not require reading every asset.
Preserve the user's authorization and unrelated work.

## Source ownership

- `source/adaptable.marketplace.json` owns provider-neutral primitive identities.
- `source/plugins/*/plugin.json` composes existing primitives by reference.
- `source/skills`, `source/agents`, `source/hooks`, `source/instructions`,
  `source/concepts`, `source/profiles`, `source/evals`, `source/schemas`, and
  `tools` own authored content. Follow [source instructions](source/AGENTS.md)
  before changing those primitives.
- Generated provider trees and installed caches are consumers. Change their
  authored owner and regenerate through the existing projector. Never hand-edit
  `.agents/plugins`, `.github/plugin`, or installed plugin caches.
- Keep upstream/system skills outside local canonical ownership. Preserve
  provenance, or make a local rewrite with a distinct name and explicit intent.

When an existing owner meets the contract, extend it. Introduce another owner
only for a responsibility the current one cannot serve.

## Select the local procedure

| When work affects | Read before the change |
| --- | --- |
| Catalog, primitive references, plugin composition, or provider output | [Source architecture](source/ARCHITECTURE.md) and [projection](docs/pkl-projection.md) |
| Native command installation, updates, removal, or setup receipts | [Command installation](docs/cli-install.md#maintainer-change-contract) |
| Pi bootstrap, packages, native hooks, or recovery | [Pi installation](docs/pi-install.md#maintainer-change-contract) |
| Versions, release admission, or promotion of retained artifacts | [Releases](docs/releases.md) |
| Decision cases, graders, routing fixtures, or execution scenarios | [Evaluations](docs/skill-evals.md) |
| Source explanations, coverage, glossary, or knowledge freshness | [Documentation](docs/documentation.md) |
| Website projection or an authorized deployment | [Site guide](docs/mintlify.md) |
| Portable global instructions or their pinned reference snapshot | [Global instructions owner](docs/global-agents.md) |
| Native instruction scope, refresh, or maintenance hooks | [Scoped instructions](docs/agents-md-scope.md) |

A read-only investigation can finish with source evidence. An implementation
request includes its necessary edits and checks. Source inspection alone cannot
establish installation, publication, native loading, or model behavior.

## Verification

Run the owning procedure's required checks for the changed surface. For marketplace
or composition changes, run the existing graph and all three root projection checks:

```bash
node tools/validate-source-graph.mjs
node tools/project-marketplaces.mjs --source . --harness codex --out /tmp/slopsentral-codex
node tools/project-marketplaces.mjs --source . --harness github-copilot --out /tmp/slopsentral-github-copilot
node tools/project-marketplaces.mjs --source . --harness amp --out /tmp/slopsentral-amp
git diff --check
```

Use fresh output directories and Pkl 0.32.0. `PKL_BIN` may select that reviewed
runtime; projection neither downloads it nor replaces an existing tree. The
[projection guide](docs/pkl-projection.md) owns explicit runtime setup.

When changing automation, use Python under the existing tooling owner. Install
the uv pin from `mise.toml` with `mise install` when setup is needed. Run
`mise exec -- slopsentral-check` for Ruff, strict Pyright, and pytest. The
[Python procedure](source/skills/python-tooling/SKILL.md) owns portable execution,
PEP 723, adjacent locks, and toolchain details.

For prose changes, run `mise exec -- slopsentral-prose changed`, keep its report,
and review located findings. For source changes, examine affected explanations
through the documentation procedure. For changed bundled assets, refresh and
verify the portable snapshot through its existing producer.

When an example changes a model decision or skill scope, map it to the existing
case owner in the evaluation guide. Keep offline controls, supplied-text decisions,
and native execution evidence distinct. Missing tools or unassessed effects do
not pass a gate.

<!-- OPENWIKI:START -->

## OpenWiki

This repository has a generated `openwiki/` evidence index. It is optional just-in-time context, not required startup reading.

- Do not enumerate, preload, or search wikis at task start. Use retrieval when the user asks for it, when unfamiliar architecture or dependency behavior materially affects the task, or when source inspection leaves an important uncertainty. Stop once the question is grounded.
- When those conditions apply and OpenWiki retrieval tools are available, use `openwiki_search` for just-in-time context and `openwiki_read` for the relevant complete sections. If search returns `workspace_required`, ask which listed workspace to use and retry with its ID.
- Use `openwiki_list_workspaces` or `openwiki_list_wikis` when workspace membership itself needs to be discovered.
- If the retrieval tools are unavailable, read `openwiki/quickstart.md` and follow its links to the relevant pages.
- Treat source code and tests as authoritative. A brief's unknowns and review items are verification gaps, not automatic requirements.
- Prefer the narrowest quiet validation that proves the changed behavior. Preserve complete failure output.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->
