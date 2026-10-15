# Hook Primitive Instructions

## Scope

This file applies to reusable hook assets under `source/hooks/`.

## Contract

- Keep hook implementations usable without installing any plugin.
- Store provider-neutral hook metadata in `*.hook.json`.
- Store runtime adapter projections under adapter-named directories such as
  `source/hooks/codex/`.
- Keep executable scripts at the hook root unless they are adapter-specific.
- Reference related skills, agents, or concepts through `dependsOn` in the hook
  metadata rather than embedding their full guidance.
- Use a `RESOURCE` dependency for one executable or data file. Keep a `SKILL`
  dependency when its procedure is required; a runtime helper alone does not
  require the full workflow. See [workflow resources](../../docs/workflow-resources.md).
- For Codex context injection, use a `SessionStart` adapter and emit
  `hookSpecificOutput.additionalContext`. Read bundled dependencies through
  `PLUGIN_ROOT`; do not assume the repository source tree is present at runtime.
- Do not point hook metadata at runtime caches, installed plugin copies, or
  generated bundles as authority.
- If a hook came from another source, keep public-safe provenance in the hook or
  plugin documentation.

## Verify

- Run all three local Pkl projections from root `AGENTS.md` after hook metadata changes.
- Pi uses TypeScript because its host loads TypeScript extensions.
  Run `npm run check:pi` and the Pi tests under `tools/tests/` after Pi adapter changes.
- Run syntax checks for every executable hook implementation touched.
