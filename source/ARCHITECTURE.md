# Catalog Architecture

A workstream owns one outcome family. Its plugin composes canonical primitives;
a profile selects several plugins for a broader workflow. Every installed
primitive has one plugin owner, including dependencies introduced by hooks.

## Primitive Responsibilities

| Primitive | Owns | Does not own |
| --- | --- | --- |
| Concept | A portable invariant and its rationale | Repository-specific commands or workflow orchestration |
| Instruction | A default policy adapter for the selected workstream | A second copy of every skill's procedure |
| Skill | A triggered procedure and completion evidence | Automatic authority to publish, deploy, or change unrelated state |
| Agent | A bounded delegated result and review criteria | An assumed model, unavailable tool, or competing write owner |
| Hook | A deterministic event check or explicit advisory | Proof that the model obeyed guidance, or a portable security boundary |
| Plugin | Install composition and routing boundary | Payload copies or hidden ownership through dependency edges |
| Profile | Selection of plugin owners | Duplicated primitives or a second implementation |
| Evaluation | A test contract or an observed result, labeled distinctly | An invented behavioral measurement |

## Routing

Select the narrowest skill whose output matches the request. A pure prose edit
uses controlled-technical-writing. A runbook or ADR uses technical-documentation.
Site navigation uses site-docs-authoring. A signature-backed knowledge bundle
uses code-knowledge-base. These may be sequenced when their outputs are needed;
they are not aliases for every task containing the word documentation.

Kotlin domain representation uses kotlin-design-practices. Public function and
platform ownership uses kotlin-api-surface-design. Branch shape uses
kotlin-branching. Build evidence uses kotlin-gradle-validation. Do not load all
Kotlin references merely because a file ends in `.kt`.

Local Git, CLI pipelines, shell integration, and mise belong to developer-tools.
Hosted issues, PRs, Actions, and pipeline architecture belong to effective-delivery.
A pipeline design establishes stage and artifact boundaries; github-ci-operations
implements and diagnoses the GitHub-specific workflow.

## Composition and Evidence

`plugin.json` is the only composition authority. `catalog.mjs` reads those
manifests, follows hook dependencies, rejects duplicate owners and conflicting
identities, and renders CATALOG.md. It has no provider-specific projection rules.
projeKtor v1.1.0 remains the owner of Codex and GitHub Copilot projection.

Marketplace-listed standalone specialties can have no plugin owner. They are
not implicitly installed by a profile. A selected plugin cannot smuggle another
plugin's skill into its package through a hook dependency. Repeated references
inside one plugin closure are idempotent.

The generated catalog and `--profile <name> --json` expose instruction word counts
and install closure. They do not measure prompt loading, tokens, or route quality.
Tests mutate the source graph to prove that invalid composition is rejected.
The existing golden routing fixtures remain expected contracts; they are not new
Astra runs. New behavioral scenarios are explicitly unobserved until executed.

## Model Guidance

The Astra adaptation is in `instructions/agent-execution.md`, installed once by
engineering-baseline. It addresses follow-through, genuine approval boundaries,
skill precedence, bounded delegation, proportionate verification, and direct prose.
It changes task guidance, not the host's policy or the user's authority.

The portable concept in `concepts/evidence-calibrated-execution/core.md` explains
the invariant independently. It is not another automatically loaded instruction.
Tool-specific details remain in skills and references. Explicit user instructions
win over generic skill guidance within higher-priority policy.

## Hook Policy

The required-skill-read adapter belongs to agent-platform-authoring, not general
engineering or Kotlin defaults. Its default requirements are empty and advisory.
A consuming repository must explicitly name any required skills; missing optional
configuration does not become a reason to block all tools. Schema-read tracking
is not proof that the model understood or applied a schema.

The Gradle and wrapper hooks retain their executable checks and Kotlin-specific
dependencies. Their old TDD and shell-safety dependencies were reading guidance,
not runtime dependencies, and no longer duplicate those skills into Kotlin.
Repository-specific required checks remain mandatory. Generic skill instructions
must not invent broader tests, universal review ceremonies, or repeated approvals.

## Updating

Edit the canonical primitive and manifest, update relevant scenarios, run the
source graph gate, regenerate CATALOG.md, and run required tests and both pinned
projections. Add a plugin only for a distinct installable workstream. Prefer a
focused reference or a narrower trigger over another overlapping skill.
