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

1. Name the consumer, installation scope, source owner, and selected profile.
2. Inspect canonical primitives, callers, runtime adapters, schemas, and current projection commands.
3. Reuse independent primitives and declare dependencies through local references.
4. For hooks, define the event, input, output, timeout, and failure policy before code.
5. For instructions, place shared rules at their owning ancestor and local differences in scoped files.
6. Change the owning source and update its catalog references.
7. Run the source graph gate and the focused composition helper.
8. Project both providers into fresh output directories with the local Pkl projector.
9. For hook changes, run the configured command with success and failure inputs outside the plugin root.

```sh
uv run --locked tools/marketplace.py validate
uv run --locked python source/skills/plugin-composition-authoring/scripts/check_plugin_composition --plugin <name>
uv run --locked tools/marketplace.py project --source . --harness codex --out <fresh-codex-directory>
uv run --locked tools/marketplace.py project --source . --harness github-copilot --out <fresh-copilot-directory>
git diff --check
```

## References

- Read [plugin shape](references/referential-plugin-shape.md) for primitive references and resource dependencies.
- Read [marketplace catalog](references/marketplace-catalog.md) for catalog entries and projection proof.
- Read [hooks](references/hooks.md) for event protocols, runtime adapters, dependency declarations, and executable proof.
- Read [instruction scope](references/instruction-scope.md) for source ownership and scoped `AGENTS.md` files.

## Completion

Every reference resolves to one canonical owner.
The catalog, schemas, selected profile, and provider projections agree.
Hook output obeys the host protocol under representative execution.
Report static acceptance separately from installed host evidence.
