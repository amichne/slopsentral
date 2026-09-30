# Catalog Architecture

A plugin packages a recognizable job and composes canonical primitives;
a profile selects several plugins for a broader workflow. Every installed
primitive has one plugin owner, including dependencies introduced by hooks.

## Primitive Responsibilities

| Primitive | Owns | Does not own |
| --- | --- | --- |
| Concept | A portable invariant and its rationale | Repository-specific commands or workflow orchestration |
| Instruction | A concise policy dependency delivered through an explicit host capability | An assumed automatic load from a plugin directory |
| Skill | A triggered procedure and completion evidence | Automatic authority to publish, deploy, or change unrelated state |
| Agent | A bounded delegated result and review criteria | An assumed model, unavailable tool, or competing write owner |
| Hook | A deterministic event check or explicit advisory | Proof that the model obeyed guidance, or a portable security boundary |
| Plugin | Install composition and routing boundary | Payload copies or hidden ownership through dependency edges |
| Profile | Selection of plugin owners | Duplicated primitives or a second implementation |
| Evaluation | A test contract or an observed result, labeled distinctly | An invented behavioral measurement |

## Selection

Software Engineering is the single code-work default. Add language, platform,
or output specialties as needed; writing-only work can select Technical Writing
alone. Repository Knowledge generates maintained artifacts and is optional.
Plugin installation makes skills available; task intent selects procedures.
A skill or ticket cannot manufacture publication authority.

Manifest `metadata.role` is one of `default`, `specialty`, or `advanced`.
The catalog validator rejects unknown roles and requires exactly one default.
The generated chooser groups by this field. The provider projector derives its
plugin display name from the plugin ID and description from the manifest;
advanced-policy wording therefore remains explicit in the projected description.

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

Software Engineering packages everyday design, tests, local Git, shell safety,
CLI data queries, mise, hosted issues, PRs, Actions, and delivery pipeline design.
CLI Development packages CLI authoring, shell integration, and terminal UI design.
A pipeline design establishes stage and artifact boundaries; github-ci-operations
implements and diagnoses the GitHub-specific workflow.

## Composition and Evidence

`plugin.json` is the only composition authority. `catalog.mjs` reads those
manifests, follows hook dependencies, rejects duplicate owners and conflicting
identities, and renders CATALOG.md. It has no provider-specific projection rules.
projeKtor remains the owner of Codex and GitHub Copilot projection.

An optional `codexMcpServers` declaration references a plugin-adjacent
`.mcp.json` packaging file. The projector copies it into the Codex plugin and
records its digest. The server executable and its installation remain owned by
the server's project.

Marketplace-listed standalone specialties can have no plugin owner. A v2 profile
installs one only when it explicitly declares the skill `PRESENT`; `ABSENT`
disables its stable user path without deleting it, and `PRESERVE` leaves it out
of the overlay. A selected plugin cannot smuggle another plugin's skill into its
package through a hook dependency. Repeated references inside one plugin closure
are idempotent.

The generated catalog and `--profile <name> --json` expose instruction word counts
and install closure. They do not measure prompt loading, tokens, or route quality.
Tests mutate the source graph to prove that invalid composition is rejected.
The existing golden routing fixtures remain expected contracts; they are not new
Astra runs. New behavioral scenarios are explicitly unobserved until executed.

## Model Guidance

The execution policy is in `instructions/agent-execution.md`, owned by
software-engineering. It addresses follow-through, genuine approval boundaries,
skill precedence, bounded delegation, proportionate verification, and direct prose.
It changes task guidance, not the host's policy or the user's authority.

The portable concept in `concepts/evidence-calibrated-execution/core.md` explains
the invariant independently. It is not another automatically loaded instruction.
Tool-specific details remain in skills and references. Explicit user instructions
win over generic skill guidance within higher-priority policy.

## Hook Policy

The required-skill-read adapter belongs to the opt-in skill-read-policy plugin,
not general engineering, agent authoring, or Kotlin defaults. Its default
requirements are empty and advisory. A consuming repository must explicitly
name required skills and select the policy plugin; missing optional configuration
does not become a reason to start a hook for every tool. Schema-read tracking is
not proof that the model understood or applied a schema.

Software Engineering, API Contracts, and Kotlin Engineering deliver concise
instruction dependencies through their read-only context hooks. Codex's
documented `SessionStart` output adds `additionalContext` as developer context;
the adapters cover startup, resume, clear, and compact. Each invocation emits
the complete current bundle. No transcript fingerprint or timer claims that
previous output is still loaded. Full semantic concepts remain deferred references.
The former AGENTS.md turn tracker is retired. Native observations showed that
it wrote `.agent-turn/` during read-only proof audits and prose edits, then
checked repository state on every stop. Applicable instruction discovery stays
with the host; explicit instruction-topology work stays with its skill.

The host owns plugin selection, hook discovery, trust, and context consumption.
Installing files or generating a plugin-level `AGENTS.md` index does not prove
that the model receives them. Untrusted, disabled, or unsupported hooks do not
deliver policy. Skills must carry their own relevant rules and skill-local
references without depending on a plugin or an unspecified repository substitute.
No Slopsentral binary or repository-profile startup hook installs plugins, launches the host,
or rewrites repository configuration. Profiles describe explicit selections;
the checkout-local lifecycle tool remains available for maintenance and rollback
of saved transactions.

The Gradle and wrapper hooks retain their executable checks and Kotlin-specific
dependencies. Their old TDD and shell-safety dependencies were reading guidance,
not runtime dependencies, and no longer duplicate those skills into Kotlin.
Repository-specific required checks remain mandatory. Generic skill instructions
must not invent broader tests, universal review ceremonies, or repeated approvals.

## Delivery Evidence

The source graph verifies that context-hook arguments match their canonical
instruction dependencies and cover all supported lifecycle sources. Python
checks exercise complete output and closed failures, including missing policy,
invalid events, escaping paths, and size limits. The same Node integration check
runs the generated command outside the plugin root to prove package resolution.
These checks prove hook output, not host consumption or model obedience.

For native evidence, install the projected package through the host, start a
fresh conversation, inspect hook completion and developer-context delivery,
then run representative direct, indirect, negative, and boundary requests.
Preserve actual results and usage separately from expected routing fixtures.
Do not claim a model-quality improvement from a schema check or skill read.

The September 29 native checks observed all four canonical policies in developer
context at startup. Task replays loaded TDD for an empty-test-selection audit,
controlled technical writing for prose in a Pkl-marked repository, and OpenAPI
schema modeling for a component-only change. The replays left no `.agent-turn/`
state. Independent Ajv checks accepted three intended schema payloads and rejected
twelve invalid payloads; unrelated OpenAPI fields were unchanged. These are
bounded observations on gpt-6-astra, not a broad accuracy or token-cost claim.
Native resume, clear, and compact consumption remain unobserved; the adapter
and output checks cover those sources. Sanitized routing misses and replays stay
in `evals/routing/field-observations.json`, including an explicit absent route.

The official [skill guidance](https://developers.openai.com/plugins/build/skills),
[plugin packaging](https://developers.openai.com/plugins/build/plugins), and
[hooks contract](https://learn.chatgpt.com/docs/hooks) govern provider behavior.
The current projector emits the supported Codex compatibility manifest. Portable
root manifests require a change in projeKtor, the projection owner; never emulate
that migration by patching generated output here.

## Updating

Edit the canonical primitive and manifest, update relevant scenarios, run the
source graph gate, regenerate CATALOG.md, and run required tests and both pinned
projections. Add a plugin only for a distinct installable workstream. Prefer a
focused reference or a narrower trigger over another overlapping skill.
