# Repository Instructions

Type safety and verifiability are the default. Treat JSON manifests as
contracts, validate them after edits, and do not patch generated provider output
by hand when the authored source can be fixed instead.

## Marketplace Ownership

- `source/adaptable.marketplace.json` is the provider-neutral marketplace source
  for `slopsentral`.
- `source/plugins/*/plugin.json` composes primitives by reference. Do not copy
  primitive payloads into plugin folders.
- `source/skills`, `source/agents`, `source/hooks`, `source/concepts`,
  `source/profiles`, `source/evals`, `source/schemas`, and `tools` are
  canonical authored roots.
- Generated provider output is published on `main` under `.agents/plugins`
  (Codex) and `.github/plugin` (GitHub Copilot), and on the corresponding
  `harness/codex` and `harness/github-copilot` branches.
- Regenerate these trees from validated authored source with the local Pkl projector; never
  hand-edit them. Publication updates both trees on `main` in one commit and
  preserves all authored files.
- Installed caches under `~/.codex/plugins/cache` are consumers, never source.
- Amp directory plugins project into `.amp/plugins`. `tools/projection/Amp.pkl`
  owns skill registration and turn-start instructions. Hooks, agents, and MCP
  configuration remain reference-only; workflow profiles are unsupported.
  `Publish Harnesses` publishes Amp only to `harness/amp`, not `main`, so the
  authored checkout does not automatically activate every bundle.

## Pi Installation Entry Point

`tools/install-pi.sh` preserves the documented curl-to-shell entry point.
It delegates to the tested native installer from the selected stable release.
`tools/setup-pi.mts` owns settings migration and private recovery.
`tools/projection/Pi.pkl` owns the content-only native default package shape;
`tools/package_pi.py`, `tools/pi_candidate.py`, and `tools/setup_assets.py` own
archive validation and source-bound candidate/installer receipts.
`Release Slopsentral` publishes retained tested bytes only after a successful main
version increment. It is independent of `Publish Harnesses`; do not restore retired Pi extensions,
workflow emulation, or the old documentation/projector stack.
Consumer setup must not add Python, uv, Pkl, or npm prerequisites.
Run `npm run check:pi`, `node --test tools/tests/pi-*.test.mjs`, and the focused
Python Pi checks after installer/release changes. Use `PKL_BIN` to exercise native
projection and `SLOPSENTRAL_PI_ARCHIVE` to exercise archive installation.
Run `node --test tools/tests/pi-bootstrap.test.mjs` after launcher changes.

## Unified Releases

`package.json` owns the shared Slopsentral product version. Release Please manages
one root component with patch-only increments; `release-please-config.json` owns
its complete set of authored version targets. Keep plugin manifests, marketplace
plugin references, Python metadata, and both root lockfiles synchronized. Do not
include generated provider trees, dependency pins, or schema revisions as version
update targets. Run `npm run check:release` and the actual updater test at
`tools/tests/release-please.test.mjs` after release changes.

The pinned GitHub action and `release-please` test dependency must use the same
library version. Release Please only proposes version/changelog PRs using a
repository-scoped GitHub App token; the verified publisher owns tags and releases.
See `docs/releases.md` for required credentials, source-bound receipts, and the
post-publication label lifecycle. Never infer credentials or publish from silence.

## First-Party Material

Do not make upstream/system skills canonical here. Preserve upstream provenance,
or create a local rewrite with a non-colliding name and explicit intent.

## Required Checks

Run the smallest check that proves the edited surface. For marketplace or plugin
composition edits, run:

```bash
node tools/validate-source-graph.mjs
node tools/project-marketplaces.mjs --source . --harness codex --out /tmp/slopsentral-codex
node tools/project-marketplaces.mjs --source . --harness github-copilot --out /tmp/slopsentral-github-copilot
node tools/project-marketplaces.mjs --source . --harness amp --out /tmp/slopsentral-amp
git diff --check
```

The projector requires Pkl 0.32.0 (`PKL_BIN` may select an explicit executable).
Use fresh output directories. Projection never downloads a runtime or replaces
an existing tree. `node tools/install-projection-pkl.mjs --out <path>` is the
explicit checksum-verified runtime setup boundary.

## Shared Engineering Baseline

Read and apply [the canonical engineering baseline](source/instructions/engineering-design.md)
for all work. Software Engineering delivers this same source through its context
hook; language and domain instructions refine it.

New automation uses required uv, strict Pyright, Ruff, pytest, PEP 723 metadata,
locked dependencies, and `tool.uv.no-build = true`. Run `uv run --locked tools/check.py`
for the Python boundary checks. Use `uv run --locked tools/setup.py` for explicit
checkout setup. Keep generated outputs and installed caches outside authored edits.

## Core Skill Evals

`source/evals/promptfoo/cases.mts` owns active decision cases and expected answers,
including the session-grounded regressions. Extend this owner instead of adding
a parallel decision catalog or campaign runner.
`promptfooconfig.ts` selects the live decision suite. `tools/promptfoo` owns the adapters.
Read skill text from `source/skills`, not generated trees or installed caches.
Supply case-specific routed references explicitly and record their source hashes.
After eval changes, run `npm run check:evals` for type checks and offline controls.
Run `npm run eval:skills` for fresh model responses through the pinned Codex SDK.
Normal CI runs offline controls without model calls or credentials.
Keep raw reports under ignored `.promptfoo/`. Keep offline controls separate from model evidence.
The decision suite scores supplied skill text and references, not automatic routing or tool execution.

`source/evals/promptfoo/execution/` owns the five plugin benchmark definitions
and 45 scenarios. `npm run eval:execution` runs them through the custom streamed
Codex SDK provider in `tools/promptfoo/execution-runtime.mts`. Select an explicit ignored
fixture registry with `SLOPSENTRAL_EXECUTION_FIXTURES`. Bind each case to a target,
scenario, absolute repository path, full commit SHA, context, and independent
host verifier path and content hash. Missing fixtures are nonpassing
`BLOCKED_SETUP` with no model call; never replace them with synthetic live scores.
Use disposable private worktrees, isolated `HOME`/`CODEX_HOME`, validated fresh
projections, and native plugin installs. Preserve benchmark model, sandbox, and
approval settings; disable web search, sandbox network, retries, and caching.
Require independent evidence for every exact checklist item plus route and scope;
missing or unassessed evidence never passes. Do not let the model grade itself.
Retain JSONL events, including failed partial turns, fixture and installation
identities, initial/final status and diffs, and verifier outputs under ignored
`.promptfoo/execution/`; the report is `.promptfoo/results/execution.json`.
Keep routing fixtures and archived assessments separate from both live suites.
Integration and offline checks do not establish live passes or measured improvement.

## Portable Global Instructions

`tools/install_global_agents.py` owns the portable installation and its local
reference snapshot. `tools/global_agents.lock.json` pins the source assets.
The [source map](docs/global-agents.md) describes the installation contract.

After changing a bundled source, review its effect on the portable guidance.
Refresh its digests with `uv run --locked tools/install_global_agents.py manifest --write`.
Run `uv run --locked tools/install_global_agents.py manifest` to examine freshness.
Keep installed `.slopsentral` snapshots outside authored edits.

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
