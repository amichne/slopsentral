# Skills, agents, and shared guidance

Use these assets for task instructions and reusable policy.
[Plugins](composition.md) select them by reference.

## Skills

Each skill lives under `source/skills/<name>/` with a `SKILL.md` entry point.
Frontmatter names the skill and describes its trigger.
The body routes the task to a focused procedure and its references.

Keep details in `references/`, deterministic helpers in `scripts/`, and supporting files in `assets/`.
Bundle a file only when a consumer needs it.
A skill must remain useful without plugin text or automatic context hooks.

[Skill Primitive Authoring](../../source/skills/skill-primitive-authoring/SKILL.md) owns the authoring procedure.
[Model Instruction Design](../../source/skills/model-instruction-design/SKILL.md) defines behavior contracts for prompts, agent guidance, task briefs, and tool descriptions.
Developer Tooling distributes both skills.
Model Instruction Design keeps existing authority, distinguishes evidence from hypotheses, and ties claims to the interface that the assessment exercises.
Its [provenance](../../source/skills/model-instruction-design/references/provenance.md) records the Amp source and local design choices.
The [skill instructions](../../source/skills/AGENTS.md) define local conventions.

## Agents

`source/agents/` contains focused review agents and their supporting files.
Each agent declares its trigger, scope, exclusions, and returned evidence.
For example, [Schema Type Enforcer](../../source/agents/schema-type-enforcer.agent.md) reviews external contracts and the types that consume them.

Use an agent for a separate delegated result.
Use a skill for a procedure that the current agent applies.
A provider can project an agent as a review prompt instead of a separate agent process.
Pi's review prompts use the current session and model.

## Instructions and concepts

`source/instructions/` owns shared policies.
The [engineering baseline](../../source/instructions/engineering-design.md) defines invariant ownership, explicit effects, legal transitions, and evidence limits.
Context hooks can supply these files to a host.
The [portable instruction installer](../global-agents.md) also consumes a pinned source snapshot.

`source/concepts/` contains reusable semantic guidance.
For example, [Kotlin Code Correctness](../../source/concepts/kotlin-code-correctness/core.md) describes correctness rules for Kotlin code.
These instruction assets differ from OpenWiki's source-backed explanations of this repository.
OpenWiki owns those maintained explanations and native Claims.

## Templates and changes

`source/templates/primitives/` supplies scaffolds for skills, agents, and hooks.
A scaffold starts an asset. It does not establish its behavior.

Before an edit, inspect the existing consumer and nearby procedure.
After an edit, examine the source graph and run the helper's focused gates.
For prose, run the repository's prose assessment.
For decision cases, use the [evaluation procedure](contracts-and-evals.md#evaluation-layers).

Shared assets keep one source even when multiple plugins select them.
For example, Python Tooling belongs to both Software Engineering and Developer Tooling.
Use the [contribution guide](contribute.md#choose-the-smallest-gate) for commands.
