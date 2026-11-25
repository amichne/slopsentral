---
name: "plugin-composition-authoring"
description: "Create or revise referential plugin manifests, hook primitives, runtime adapters, marketplace entries, or scoped repository instructions. Use for composition and source ownership."
---

# Plugin Composition Authoring

Compose canonical primitives by reference.
Give each instruction, hook, and runtime adapter one source owner.
Keep installed caches and generated projections outside authored edits.

## Contract

Plugin manifests describe composition, version, and scope.
They do not own copied skills, agent profiles, or reusable hook logic.
Use repo-local schemas for manifests, hooks, adapters, and sidecars.
A new structured shape needs an owning schema before use.

Each selected hook must occur in one plugin closure.
Shared skills, agents, instructions, and resources can serve several plugins.
For session context, compose the hook whose `dependsOn` names the canonical instruction.
Do not infer runtime delivery from a valid manifest.

## Workflow

1. Name the host, installation scope, source owner, and any selected profile.
   Discover its actual plugin API; a Codex manifest, Pi extension, and Amp
   directory plugin are different delivery contracts.
2. Inspect canonical primitives, callers, runtime adapters, schemas, and current projection commands.
3. Reuse a canonical primitive when it supplies the needed behavior. Extend its
   owner for a missing branch; create a primitive only for a responsibility
   that has no suitable owner. Declare dependencies through local references.
   A composition review can report the supported choice without editing or installing it.
4. For hooks, define the event, input, output, timeout, and failure policy before code.
5. For instructions, place shared rules at their owning ancestor and local differences in scoped files.
6. For an authorized implementation, change the owning source and update its
   catalog references. Keep copied payloads and installed caches out of this path.
7. After source changes, run the owning repository's graph and composition checks.
8. For a composition or projection change, generate each supported host target
   into a fresh output directory. Record
   unsupported capabilities explicitly rather than copying foreign hook config
   and claiming activation.
9. For hook changes, run the configured command with success and failure inputs outside the plugin root.

## Slopsentral Source Graph

Use this branch only when the target owns `source/adaptable.marketplace.json`
and `tools/project_marketplaces.py`. Resolve `<skill-dir>` from the loaded
skill, independently of `<repo>`, then run the repository commands from `<repo>`.
The helper below checks this source layout; it is not a generic host installer.

```sh
node tools/validate-source-graph.mjs
uv run --locked --script <skill-dir>/scripts/check_plugin_composition --repo <repo> --plugin <name>
python3 tools/project_marketplaces.py --source . --harness codex --out <fresh-codex-directory>
python3 tools/project_marketplaces.py --source . --harness github-copilot --out <fresh-copilot-directory>
python3 tools/project_marketplaces.py --source . --harness amp --out <fresh-amp-directory>
python3 tools/project_marketplaces.py --source . --harness claude --out <fresh-claude-directory>
python3 tools/project_marketplaces.py --source . --harness pi --out <fresh-pi-directory>
git diff --check
```

## References

- Before changing primitive references or resource dependencies, read
  [plugin shape](references/referential-plugin-shape.md).
- When changing catalog entries or qualifying provider output, read
  [marketplace catalog](references/marketplace-catalog.md).
- Before changing a hook or runtime adapter, read [hooks](references/hooks.md)
  for event protocols, dependency declarations, and executable proof.
- Before changing instruction ownership or scoped `AGENTS.md` files, read
  [instruction scope](references/instruction-scope.md).

## Completion

For an implemented change, every reference resolves to one canonical owner and
the catalog, schemas, selected profile, and provider projections agree.
Changed hooks obey the host protocol under representative execution.
For a review, report the inspected contracts and proposed checks.
Report static acceptance separately from installed host evidence; neither a
review nor a successful projection authorizes installation.
