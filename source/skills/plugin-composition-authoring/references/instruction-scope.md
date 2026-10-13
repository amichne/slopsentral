# Repository Instruction Scope

Match instruction scope to real differences in commands, language, ownership, or generated output.
Folder depth and symmetry do not justify separate instruction files.

## Find the Owners

Inspect workspace manifests, Gradle files, CI workflows, generators, schema roots, plugin manifests, and deployment configuration.
Name authored sources, generated outputs, runtime copies, and installed caches.
Each structured artifact needs a schema, typed parser, or generator contract.
Link generated artifacts to their source and regeneration command.

For Gradle projects, inspect included builds, convention plugins, generated sources, and module-specific tasks.
For plugin repositories, separate canonical primitives, plugin compositions, provider projections, and installed caches.
Keep upstream or system material as provenance unless an explicit local rewrite owns it.

## Choose the Scope

Place shared rules at the highest ancestor that owns them.
Add a child `AGENTS.md` only when local behavior differs.
A local difference can be a command, language convention, source owner, generated-file rule, or explicit approval limit.
Do not repeat parent rules without a narrower scope or stated override.

Keep each instruction file short.
State its scope, authored files, generated files, commands, expected evidence, and unresolved assumptions.
Use existing instruction formats and command names.
Do not invent commands or ownership claims from directory names.

## Examine the Result

Make sure that each listed command and source file exists.
Make sure that generated output has a named source and regeneration path.
Make sure that each child contains a necessary local difference.
Report the chosen scopes and the source evidence that justifies them.
