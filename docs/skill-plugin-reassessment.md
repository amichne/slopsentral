# Reassessing Slopsentral skills and plugins

Date: 2026-10-10. Status: direction adopted; two source implementation slices.
Audience: maintainers deciding the next Slopsentral architecture experiment.

## Recommendation

Keep the canonical asset library. Own deterministic projection in typed Pkl.
Reorganize discovery around user outcomes. Treat plugin installation, workflow selection, and automatic
execution as separate decisions. Give each skill a short entry point, with
conditional references and executable helpers for the detail.

Do not aim for the fewest plugin folders. Aim for successful task selection,
useful outcomes, and a clear account of what installation can execute.
Consolidate procedures that share a result; preserve separate workflows when
their inputs, tools, outputs, or acceptance evidence differ.

This is an inference from public guidance and the current repository. It is
not a claim about OpenAI researchers' internal plugin organization.

[PR #62](https://github.com/amichne/slopsentral/pull/62) enables canonical asset
reuse. It does not implement this proposal. Its reviewed source is commit
`33b2581eb6758bd39f2b51e4b6b517e79d402da7`. The redesign is a separate
change so that the reuse PR retains its focused scope. This follow-up
implements the first slice; it does not replace installed plugins or retire compatibility entries.

The next stacked slice adds a typed resource reference for executable and data
files. Hooks can now carry a helper without exposing its whole skill as a
workflow choice. Pkl Workflows and optional Pkl Repository Checks exercise
that boundary while preserving the complete Pkl Configuration bundle. This
implements focused discovery and progressive disclosure from both labs'
guidance; measured routing and host activation remain qualification work.
See [workflow resources](workflow-resources.md) for the contract and evidence.

## What the public guidance supports

OpenAI describes skills as repeatable workflows and plugins as installation
packages. A skill may use existing tools without adding an MCP server.
Live connections and controlled actions belong in tools.
This supports keeping workflow knowledge independent of service installation.
[OpenAI: skills](https://developers.openai.com/plugins/concepts/skills),
[OpenAI: plugin architecture](https://developers.openai.com/plugins/concepts/plugins).

OpenAI's recent prompt guidance favors precise descriptions, small routing
documents, and references loaded for the current task. It warns that crowded
discovery and elaborate recipes can reduce usefulness. This supports reducing
competing entry points without discarding their domain knowledge.
[OpenAI: rethinking skills and prompts](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).

Anthropic recommends concise instructions, progressive disclosure, references
reachable directly from the skill, and constraints matched to operational
fragility. It also recommends measuring failures before adding instructions.
Design judgment can remain flexible; fragile publication and schema checks
need exact procedures.
[Anthropic: skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).

Anthropic's engineering guidance favors simple designs and adding agent
orchestration when the task needs it. That argues against turning every
specialty into a persistent persona or a mandatory delegation stage.
[Anthropic: building effective agents](https://www.anthropic.com/engineering/building-effective-agents).

Use the existing standards for the delivered package. Agent Skills defines
`SKILL.md` and its supporting resources. Agent Plugins v1 defines skills and
MCP configuration, with client extensions for other behavior. Those standards
do not replace Slopsentral's authoring graph or establish a shared runtime
import system for its canonical assets.
[Agent Skills specification](https://agentskills.io/specification),
[Agent Plugins specification](https://agent-plugins.org/specification).

OpenAI's public Build Web Apps package groups a builder and a debugging
workflow with focused React, shadcn, Stripe, and Supabase guidance. It offers
a concrete example of organizing around a user job while retaining useful
specialties. Its compatibility manifest and `agents/openai.yaml` presentation
metadata also show why directory names alone do not establish execution roles.
Use it as a structural reference, not a source of mandatory instructions.
[OpenAI: Build Web Apps package](https://github.com/openai/plugins/tree/main/plugins/build-web-apps).

## What the current source reveals

The reuse baseline has nine plugin compositions and 66 skill directories.
The tooling slice adds three compositions; the resource slice adds two more.
The catalog now has 14 compositions and preserves all 66 skills. These are
source inventory counts, not proof that every model session sees 66 skills.
Profiles and installed plugins determine the actual discovery surface.

Several boundaries deserve revision:

| Current boundary | Evidence | Consequence |
| --- | --- | --- |
| Personal Setup | Its manifest includes dotfiles, CLI products, terminal interfaces, and skill/plugin/hook authoring | A personal configuration name hides general toolmaking workflows |
| Repository Knowledge | Its manifest bundles technical prose and site docs with drift and overlay hooks | Installing writing workflows also installs hook definitions; execution depends on supported host events and configuration |
| Kotlin Engineering | Its manifest includes guidance, Gradle hooks, and a local Kast MCP command | Language knowledge is coupled to an installed service and host checks |
| Engineering Excellence | A separate plugin owns design policy and `semantic-ratchet` | A shared engineering concern becomes another default installation decision |
| Agent profiles | `schema-type-enforcer.agent.md` includes `model: sonnet` | Provider-neutral intent includes a provider-specific execution choice |
| Generic names | `agents-sdk` means Cloudflare; `workflow` means Vercel Workflow DevKit | Names alone can suggest unrelated agent SDKs or generic workflows |

Sources: [plugin compositions](../source/plugins/),
[agent profile](../source/agents/schema-type-enforcer.agent.md),
[Cloudflare skill](../source/skills/agents-sdk/SKILL.md),
[Vercel skill](../source/skills/workflow/SKILL.md).

Dependency meaning also matters. The
[source graph hook](../source/hooks/source-graph-valid.hook.json) previously depended on two
authoring skills, but its [script](../source/hooks/source-graph-valid.py) runs
the repository validator. This slice removes those instructional dependencies. The script and provider
adapter retain their behavior; authoring skills stay in the workflow bundles.
Other hook dependencies may supply executable files and must be checked
individually before changing them.

## Assign each asset one clear purpose

| Asset | Question it answers | Recommended treatment |
| --- | --- | --- |
| Repository instruction | What must hold whenever this repository is changed? | Small invariant and authority block; required checks tied to changed surfaces |
| Concept or reference | What domain detail does this task need? | Canonical library, materialized into relevant skill references |
| Skill | How do I achieve this recognizable result? | Discoverable name and description; short procedure and selective references |
| Script or tool | What can be checked or performed deterministically? | Explicit inputs, bounded effects, structured outcomes, executable checks |
| Hook | What should the host do automatically at this event? | Explicit local automation package with defined activation and failure behavior |
| Agent wrapper | Why is a separate context or capability boundary useful? | Optional adapter around a reusable procedure and output contract |
| Plugin | What coherent capability does the user install? | Referential distribution recipe; portable or explicit host integration |
| Profile | Which packages suit this project or recurring work? | Named selection of complete packages with checked dependency closures |

These are responsibilities, not a proposal for eight new frameworks.
Keep existing canonical roots unless a real packaging limit requires a change.
Keep routines as skills, references, or scripts according to their purpose.
Do not introduce a workflow DSL just to express a short conditional procedure.

Preserve the engineering dictum. Refining source into a typed boundary is
durable policy; proving a forbidden construction is an executable workflow;
Kotlin examples are conditional references. Giving each a suitable home
preserves the proof without injecting every example into every session.

## Proposed installation catalog

Use four general workflow packages, three domain additions, and one explicitly
personal package. Developer Tooling and Personal Configuration are now candidate entries. The
remaining names and boundaries below are experiments for later iterations.

| Proposed portable package | User job | Existing material it would compose |
| --- | --- | --- |
| `engineering` | Implement, diagnose, review, and deliver repository changes | Software Engineering plus Engineering Excellence; retain independently useful delivery and proof skills |
| `repository-knowledge` | Write explanations and maintain source-backed repository knowledge | Current writing and knowledge skills; no automatic overlay or drift hooks in the portable package |
| `developer-tooling` | Build CLI, shell, terminal, and agent workflow tools | General tool authoring from Personal Setup; conditional authoring references |
| `api-contracts` | Create and review schemas and API contracts | Current API workflows; reusable schema procedures and focused review output |
| `kotlin-development` | Implement, review, and diagnose Kotlin code | Kotlin workflows and references; no mandatory Kast connection or event checks |
| `intellij-development` | Develop and qualify IntelliJ plugins | Current IntelliJ workflows and their platform-specific references |
| `pkl-workflows` | Develop and verify Pkl configuration | Current Pkl workflows; optional Pkl Repository Checks supplies event hooks |
| `personal-configuration` | Maintain the user's verified shell and dotfiles setup | Personal setup management and personal variants of shell/CLI workflows |

The reuse PR lets `shell-script-safety` and `manage-json-schemas` serve more
than one package. Reuse should follow need, rather than force users to install
an unrelated bundle. A portable package may require declared tools; portable
means its packaging and guidance avoid a particular host lifecycle.

Shared skills remain allowed in simultaneously selected packages. Source
identity is checked; installed discovery deduplication is not established.
Do not assume a host merges identical copies. The pilot must inspect the
actual discovery entries and measure any repeated descriptions.
When a package needs only shared knowledge or helpers, materialize those as
references or scripts instead of exposing an extra skill entry.
Distinct variants need distinct user goals and names. Preserve intentional
full-skill reuse where it helps; report discovery overlap without reinstating
a global ownership ban.

Group optional integrations visibly with their related workflow package.
Examples include the Kast connection, Kotlin/Gradle event checks, knowledge
overlay/drift automation, Pkl event checks, and repository policy delivery.
Keep the skill-read policy an explicit advanced choice.

These are separate installation units where independent activation is needed.
Today's profiles select whole plugins; they cannot selectively subtract a
hook or MCP server from an installed plugin. Independent selection therefore
requires new generated package compositions, not just different profile data.
The total number of distribution entries may increase even as choices become
more coherent. Integration-only bundles must not add irrelevant skill entries
merely to bring along executable resources.

For a first catalog experiment, retain Personal Setup as the compatibility
bundle. Introduce Developer Tooling and Personal Configuration as alternatives.
Do not select both the old bundle and overlapping replacements in a profile.
Migrate existing profiles explicitly before retiring the old entry.

## Consolidate discovery, preserve content

Do not make every domain rule a top-level skill. Split entry points when a
user can request a distinct result and the workflow needs distinct tools or
evidence. Otherwise use named references within the relevant skill.

| Candidate | Suggested experiment |
| --- | --- |
| Kotlin coordination, design practices, branching, API design, application-stack advice | One Kotlin implementation entry with direct references for these concerns |
| Kotlin review | Keep a separate review entry because its result is findings and evidence |
| Gradle validation and Gradle performance | Keep separate diagnosis and optimization entries; measure whether their triggers overlap |
| Negative capability proof and semantic ratchet | Preserve invocable proof workflows; share language-specific examples as references |
| Skill, agent profile, hook, plugin, and repository instruction authoring | Try one agent-workflow authoring entry with routes to each artifact type |
| Primitive routing evaluation | Keep an evaluation entry with a different acceptance contract |
| Personal CLI authoring and general CLI creation | Share the creation workflow; put personal installation and `--teach` variants in references |
| Prose control, repository documents, proposals, and documentation sites | Keep distinct outputs, with a shared prose checker and shared writing references |
| Cloudflare Agents SDK and Vercel Workflow DevKit | Give them explicit vendor names; preserve provenance and migrate old references |

This is a candidate map, not a verdict based on folder counts. Existing Kotlin
coordination already links focused workflows. Replacing it with a second
orchestrator would add little. Test whether references improve that entry
before changing every related skill.

When a skill becomes a reference, migrate its requirements, examples, helpers,
citations, and callers. Record the old identity and destination in the
migration ledger. A provenance record can preserve history without exposing
a retired entry to the model. Do not register both old and new descriptions
as permanent aliases that compete for selection.

## Make role boundaries earn their place

Use task skills for reusable procedures. A reviewer wrapper is useful when
independent context or constrained tools change the evidence. An explorer
wrapper may be useful for a bounded navigation result. A title such as
Architect or Tooling Engineer is not enough to justify a separate agent.

Move provider model selection and tool restrictions into the adapter.
Keep the review criteria and findings contract in a reusable skill/reference.
For portable OpenAI submission, its conversion guidance explicitly recommends
moving reusable command and agent behavior into skills. Its public directory
also excludes lifecycle hooks; manually installed desktop distribution remains
a different route.
[OpenAI: Claude plugin conversion](https://developers.openai.com/plugins/guides/submit-claude-plugin).

This does not prohibit native subagents. It removes the assumption that a
persona must be a portable knowledge primitive or that every task needs a
team of personas.

## Reuse source; deliver self-contained packages

Keep the existing source graph. Author shared content once. Replace the external
projeKtor dependency with the repository-owned [Pkl projection](pkl-projection.md).
Generate self-contained skill resources and plugin payloads for each target.
Generated copies are distribution artifacts, with canonical source provenance.
They do not require the consumer to locate this source checkout or another
plugin's cache.

```text
source/skills/<goal>/SKILL.md        discoverable workflow
source/concepts/<topic>/core.md     shared authored knowledge
source/instructions/<policy>.md     concise shared invariants
source/hooks/...                    automatic host actions
source/plugins/<bundle>/plugin.json referential recipe
source/profiles/<project>.json      package selection

generated-plugin/
  plugin.json
  skills/<goal>/SKILL.md
  skills/<goal>/references/...
  skills/<goal>/scripts/...
  mcp.json                         only when needed
```

The generated tree illustrates a future portable target. It is not the current
provider output contract. Portable output needs schema validation and host
qualification before replacing any existing provider output.
OpenAI supports a portable root manifest and client extensions alongside its
compatibility manifest. MCP conversion requires transport declarations;
renaming `.mcp.json` is insufficient.
[OpenAI: plugin packaging](https://developers.openai.com/plugins/build/plugins).

The current reuse PR checks canonical identity, cycles, missing references,
and duplicate hooks across declared profile closures. Preserve these checks
in every candidate. They do not prove arbitrary manual installation
combinations execute once.
If a host cannot enforce composition, expose incompatible choices clearly
and verify the installed combination before claiming safe activation.

Distinguish content inclusion, executable dependencies, and related-reading
links. First inspect actual script/file usage and use existing resource
packaging. Extend the authored schema only if it cannot express a necessary
relationship; do not create a second dependency engine.

## Example: change a Kotlin API and publish its PR

The repository supplies its concise invariants and project-native checks.
The model selects Kotlin implementation and loads the API reference because
the change affects an exported boundary. It invokes available semantic tools
when caller identity needs stronger evidence. Without the required semantic
capability, it reports the unresolved boundary rather than manufacturing proof.

It runs the focused compiler or behavior check, then checks affected consumers.
Gradle diagnosis loads only if execution or report analysis needs it.
An independent reviewer is optional when separate context helps the review.
The delivery skill handles the requested commit, push, PR, and exact-head CI.
The implementation skill does not acquire standing publication authority.

A documentation-only task selects the writing workflow instead. A configured
knowledge overlay may supply context through its separately enabled host
integration. Selecting a prose skill alone does not activate that integration.

## Evaluate before migrating the whole catalog

The baseline 60 routing fixtures are useful contracts, not fresh task runs.
This slice adds three designed cases and golden fixtures for composition
boundaries, bringing the fixture contract to 63 cases.
The inspected evidence contains only 11 cases with field observations, with
one drift record and seven incomplete-proof records. Do not use fixture
consistency as proof that wholesale consolidation improves behavior.
See [routing evaluator](../tools/run-routing-evals.mjs) and
[field observation handling](../tools/routing-field-observations.mjs).

Compare three conditions: current bundles, the proposed focused entries, and
a deliberately broad single-router alternative. Add a no-skill baseline to
show which guidance provides value. Hold the task, source revision, model,
tools, and environment constant; use fresh sessions and repeated runs.
Qualify each provider separately before claiming portability.

Use representative tasks and negative controls:

- A small Kotlin branch edit, an API change across modules, and a Gradle failure.
- A CLI creation task, a shell completion change, and personal installation.
- A skill rewrite, a hook addition, and a schema-only edit.
- A prose-only edit in a Pkl repository, and a source-backed knowledge refresh.
- A local edit without publication authority, and a requested PR publication.
- Missing Kast, unavailable build tooling, conflicting assets, and overlapping hooks.

Record selected skills, irrelevant selections, loaded resources, actual token
usage when available, task completion, proof gaps, and automatic hook effects.
Use repository-native verifiers for each task. Do not run an unrelated Gradle
command to grade CLI or prose work. Preserve traces as evidence; word counts
and static scores cannot substitute for measured usage or outcomes.

Choose the candidate that preserves required behavior and demonstrates better
selection or less unnecessary work. An unresolved proof gap prevents accepting
that scenario. Retain a specialized entry if consolidation loses a useful
outcome. Define the task rubric before inspecting candidate results.

## Implemented slice and next experiments

The first slice adds Developer Tooling, Personal Configuration, and an optional
Repository Source Checks integration. Every asset retains its canonical path
and identity. The [migration ledger](../source/MIGRATION.md#tooling-redesign-pilot)
records the composition changes and profile choices. The Pkl projector replaces
the external projection dependency for both existing provider shapes.

1. Compare Developer Tooling with the retained Personal Setup bundle on real
   tasks. Inspect host discovery overlap and automatic effects in fresh sessions.
2. Consolidate authoring entry points only when the measured task results support
   it. Preserve their constraints, references, helpers, and callers.
3. Separately pilot Kotlin guidance without mandatory Kast or event hooks.
   Qualify source, both projections, and a fresh supported host session.
4. Compare real task evidence. Migrate profiles and retire compatibility
   entries only after their replacements preserve the required results.
5. Evaluate a portable Agent Plugins projection as its own change. Keep
   existing provider outputs until supported hosts prove the replacement.

Source graph checks, provider projection checks, and `git diff --check` remain
required for implementation. Reader review can assess this proposal's clarity;
it cannot prove that the proposed skills route or execute correctly.
