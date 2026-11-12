# Agent Profiles

Create a profile only when a distinct delegated responsibility justifies it.
The profile must state its role without a plugin description or conversation history.

## Contract

- Use a specific lower-case, hyphenated name.
- State the owned task, excluded work, expected inputs, and returned evidence.
- Limit tool access when the role needs fewer capabilities.
- Keep provider-specific model and display metadata optional unless the host needs them.
- Give the agent a stop condition for missing evidence or unauthorized effects.
- Keep publication and external messages within explicit user authority.

## Prompt

Write a concrete role, responsibilities, procedure, evidence standard, and result format.
For analysis, separate findings from unresolved hypotheses.
For implementation, name the owned files and focused acceptance proof.
For review, distinguish evidence-backed findings from no-findings results.
For orchestration, name dependencies, completion ownership, and failure outcomes.

## Triggers

Include realistic explicit requests and implicit requests within the same scope.
Add proactive cases only when the host and user authorize delegation.
Include a nearby request that belongs with another owner.
State what the parent receives and when the task ends.

Before promotion, compare names and triggers against `source/agents/`.
Examine frontmatter, tool access, overlap, missing-context behavior, and the output contract.
Compose the profile by reference only after the canonical file exists.
Keep public-safe source provenance with the primitive.
