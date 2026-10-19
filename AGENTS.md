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
- Pi packages project into `.pi/slopsentral` for local installation.
  The Pi adapter lives under `source/hooks/pi/`.
  `tools/projection/Pi.pkl` owns its package shape.
  `Validate Source` keeps a tested Pi candidate before release.
  `.github/workflows/release-pi.yml` publishes those bytes through GitHub Releases.
  `tools/package_pi.py` owns archive contents, version overrides, and checksums.
  `tools/pi_candidate.py` owns producer admission, source identity, candidate reuse,
  and promotion records. `source/schemas/pi/` owns the public provenance shapes.
  Release archives need no repository clone or local npm build for installation.
- `tools/install-pi.sh` is a thin POSIX host launcher for the published package.
  Keep installation logic in Pi's package manager.
- `tools/marketplace.py project --harness pi --profile <name>` compiles a content-only trial.
  `tools/projection/Pi.pkl` owns file selection and unsupported-capability rejection.
  Deploy its `AGENTS.md` through the consumer's native instruction scope.
  See `docs/pi-content-profile.md` for the trial and retired runtime guarantees.

## First-Party Material

Do not make upstream/system skills canonical here. Preserve upstream provenance,
or create a local rewrite with a non-colliding name and explicit intent.

## Required Checks

Run the smallest check that proves the edited surface. For marketplace or plugin
composition edits, run:

```bash
uv run --locked tools/marketplace.py validate
uv run --locked tools/marketplace.py project --source . --harness codex --out /tmp/slopsentral-codex
uv run --locked tools/marketplace.py project --source . --harness github-copilot --out /tmp/slopsentral-github-copilot
uv run --locked tools/marketplace.py project --source . --harness pi --out /tmp/slopsentral-pi
npm run check:pi
git diff --check
```

For Pi release changes, run the focused release checks:

```bash
uv run --locked pytest tools/python_checks/test_package_pi.py tools/python_checks/test_pi_candidate.py tools/python_checks/test_pi_release_workflows.py
actionlint .github/workflows/validate-source.yml .github/workflows/release-pi.yml
```

The projector requires Pkl 0.32.0 (`PKL_BIN` may select an explicit executable).
Use fresh output directories. Projection never downloads a runtime or replaces
an existing tree. `uv run --locked tools/install_projection_pkl.py --out <path>` is the
explicit checksum-verified runtime setup boundary.

## Documentation

`docs/public/docs.json` owns Mintlify navigation.
`docs/pi-harness.md` owns the Pi guide.
Run `npm run docs:sync` to regenerate `docs/public/guides/pi.mdx`.
Do not edit that generated page directly.
Use Node.js 24.21.0 for the pinned Mintlify CLI.
After page, navigation, or asset changes, run `npm run docs:check`.
Use `npm run docs:dev` for the browser preview.
Keep assessment reports and browser evidence outside `docs/public`.
A preview does not prove the public deployment serves the same source.

## Shared Engineering Baseline

Read and apply [the canonical engineering baseline](source/instructions/engineering-design.md)
for repository work. The default plugin supplies the focused design skill.
Language and domain instructions refine the repository rules.

New automation uses required uv, strict Pyright, Ruff, pytest, PEP 723 metadata,
locked dependencies, and `tool.uv.no-build = true`. Run `uv run --locked tools/check.py`
for the Python boundary checks. Use `uv run --locked tools/setup.py` for explicit
checkout setup. Keep generated outputs and installed caches outside authored edits.
