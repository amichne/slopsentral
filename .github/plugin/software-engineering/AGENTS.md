# Software Engineering Plugin Instructions

## Scope

This generated adapter applies to the `software-engineering` plugin payload. Do not edit it directly; update the provider-neutral primitives or plugin manifest, then regenerate the marketplace output.

## Runtime Boundary

The source graph keeps skills, agent profiles, instructions, concepts, and hooks as independent primitives. This `AGENTS.md` adapts bundled agent and instruction primitives into a plain instruction file for runtimes that do not expose those primitive kinds directly.

## Plugin Intent

Implement, test, review, and deliver code with Git, PR, and CI workflows.

## Operating Rules

- Treat this file as an adapter, not a new source of truth.
- Use bundled skills for step-by-step workflows.
- Apply bundled instructions as normative guidance when their scope matches the task.
- Treat bundled agent profiles as review criteria or focused review passes.
- Keep hook behavior in bundled hook files and runtime adapter configs.
- When guidance conflicts with the target repository's nearest `AGENTS.md`, follow the target repository unless the user explicitly chooses this plugin's rule.

## Instruction Primitives

- `agent-execution`: `instructions/agent-execution.md` (source: `source/instructions/agent-execution.md`)
- `engineering-design`: `instructions/engineering-design.md` (source: `source/instructions/engineering-design.md`)

## Skill Primitives

- `bounded-delegation`: `skills/bounded-delegation` (source: `source/skills/bounded-delegation`)
- `cli-data-pipelines`: `skills/cli-data-pipelines` (source: `source/skills/cli-data-pipelines`)
- `define-goal`: `skills/define-goal` (source: `source/skills/define-goal`)
- `delivery-pipeline-design`: `skills/delivery-pipeline-design` (source: `source/skills/delivery-pipeline-design`)
- `git-change-flow`: `skills/git-change-flow` (source: `source/skills/git-change-flow`)
- `github-ci-operations`: `skills/github-ci-operations` (source: `source/skills/github-ci-operations`)
- `issue-tracker-operations`: `skills/issue-tracker-operations` (source: `source/skills/issue-tracker-operations`)
- `mise-project-tooling`: `skills/mise-project-tooling` (source: `source/skills/mise-project-tooling`)
- `pull-request-lifecycle`: `skills/pull-request-lifecycle` (source: `source/skills/pull-request-lifecycle`)
- `repository-onboarding`: `skills/repository-onboarding` (source: `source/skills/repository-onboarding`)
- `semantic-ratchet`: `skills/semantic-ratchet` (source: `source/skills/semantic-ratchet`)
- `shell-script-safety`: `skills/shell-script-safety` (source: `source/skills/shell-script-safety`)
- `tdd`: `skills/tdd` (source: `source/skills/tdd`)

## Hook Primitives

- `agents-md-turn-refresh`: `hooks/agents-md-turn-refresh.hooks.json` (source: `source/hooks/agents-md-turn-refresh.hook.json`)
- `repository-profile`: `hooks/repository-profile.hooks.json` (source: `source/hooks/repository-profile.hook.json`)
