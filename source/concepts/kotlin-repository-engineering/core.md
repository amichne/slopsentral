# Kotlin Repository Engineering Standard

## Scope

This standard applies to Kotlin and Gradle repository structure, repository
instructions, implementation-task evidence, generated-source ownership, and
verification breadth. It complements code-level Kotlin rules by defining how
modules, integration boundaries, task proof, and local `AGENTS.md` files work
together.

This standard does not prescribe one module count, documentation tool, IDE,
semantic indexer, CI provider, or distribution format. Local repository facts
remain authoritative when they are explicit and mechanically verifiable.

## Quick Use

1. Read the root instructions and the nearest local instructions for every path
   in scope.
2. Use the Gradle settings file as project-membership authority and map each
   project to an owner, dependency direction, and focused verification command.
3. Keep domain contracts and pure behavior inward; keep effects and library
   implementations in adapters; select the complete graph in one minimal
   integration module.
4. Define each implementation task in the active session before editing, then
   preserve executable red and green proof beside that definition.
5. Edit authored sources, not generated outputs, and verify the generation
   boundary when it changes.
6. Verify outward from the focused behavior through owners and direct consumers,
   stopping at the first ring that fully covers the change.
7. When the repository ships an installed CLI, plugin, service, or distribution,
   exercise that public artifact after behavior-changing commits at meaningful
   integration boundaries.

## Repository Authority Map

The Gradle settings file must be the authority for project membership. The root
repository guidance must summarize each project or project family, its broad
owner, its permitted dependency direction, and where narrower instructions
apply. The map must be derived from current manifests and directories rather
than remembered topology.

The repository root must orchestrate verification and composition. It must not
become a shared domain module merely because every project can reach it. Build
logic may configure the graph and define reusable task types, but it must not
become a product dependency.

When settings, project layout, ownership, or dependency direction changes, the
authority map and affected local instructions must change in the same work.

## Module Direction And Integration

Dependencies must point toward stable, domain-owned contracts and pure evidence.
Core modules must not depend on transport, persistence, framework, engine, IDE,
serializer, CLI, or SDK implementations. Service modules may depend on their
contracts and narrower contracts. Adapter modules may depend on the external
implementation they adapt. One small application or integration module must own
configuration and select the complete implementation graph.

A replacement implementation should require changes to its adapter and the
integration binding, not to domain callers. Public cross-module APIs must use
domain-owned types and finite failures. A mechanical dependency or public-API
check must reject implementation dependencies or types that leak into pure
modules.

## Session-Scoped Task Evidence

Every implementation task must keep its definition and proof in the active
session directory. The location may come from any harness or workflow; repository
policy must not depend on one provider, environment variable, or hard-coded
machine path.

Each session must own a `tasks/` directory. Allocate the next three-digit task
directory, beginning with `001`. A task definition consists of exactly these five
files:

- `TASK.md` states the current context, requested outcome, reason, and observable
  completion condition.
- `red.md` states the first missing behavior, its exact expected observation,
  why that observation proves the red case, and names `red.sh` as authority.
- `red.sh` exposes the underlying check and exits successfully only when the
  expected missing behavior is observed.
- `green.md` states the required successful cases, their observations, why they
  prove completion, and names `green.sh` as authority.
- `green.sh` exposes the required checks and exits successfully only when every
  green case passes.

Run the red authority before implementation and save its complete standard
output, standard error, script identity, and final status in `red-proof.out`.
Run the green authority after implementation and save the same evidence in
`green-proof.out`. A proof is valid only when it matches the current task
definition, reports a zero proof-script status, and contains the observations
needed to judge the case. Captured proof output is authoritative; summaries and
uncaptured commands are not substitutes.

Task evidence is session-local. Durable architecture decisions belong in the
repository's normal authored documentation after they have lasting value.

## Progressive Instruction Disclosure

Root `AGENTS.md` guidance must contain only repository-wide policy, topology,
source authorities, and verification shape. The nearest child guide may add
local owners, invariants, generated boundaries, and focused commands, but it
must not silently weaken an ancestor contract.

Every Gradle project must be represented in the root topology. Add a child guide
when a project or nested owner directly owns files and has local invariants,
commands, generated boundaries, lifecycle rules, or dependency constraints that
would make the parent guidance misleading. A grouping directory that only
contains child owners inherits its nearest guide and does not need a placeholder.

Do not duplicate parent rules. Move a shared rule to the narrowest common owner.
When code or ownership moves, update every affected guide and verify that named
paths, symbols, tasks, manifests, and authorities still exist.

## Authored And Generated Surfaces

Configuration and source manifests must identify the authority for generated
documentation, code, schemas, protocol bindings, plugin output, and distribution
layout. Agents must edit the authored source and regenerate the consumer output.
Generated output must not be patched by hand when its source can be corrected.

A local guide must name the source authority and the focused generation or drift
check whenever a subtree mixes authored and generated files.

## Installed-Artifact Dogfooding

When a repository ships a user-facing artifact, tests and staged build output do
not replace observing installed public behavior. Refresh the installed artifact
when branch identity, provenance, packaging, or a meaningful behavior-changing
commit makes the previous installation stale. Do not reinstall after every edit.

After a commit changes public behavior, run the installed command, plugin,
service, or distribution through the same entry point a user invokes. Record the
observed identity and behavior. If installation is unavailable, state that limit
instead of presenting unit or staging proof as installed-product proof.

## Widening Verification

Verification must widen according to the changed contract:

1. Run the focused test, script, or task named by the nearest owner.
2. Run the owning module's test or check task.
3. Run direct consumers when a public API, schema, convention, payload, storage,
   or lifecycle boundary changed.
4. Verify project and instruction coverage when settings or layout changed.
5. Run cross-module tests or builds when conventions, publication, packaging, or
   shared behavior changed.
6. Run repository-shape, generated-drift, shell-contract, installation, and
   distribution checks when the changed boundary crosses Gradle.

Stop at the first ring that fully covers the change. A broad successful build
does not replace a focused proof that can fail for the intended reason.

## Turn-Scoped Guide Maintenance

Review changed directories and their ancestors after implementation. Update an
existing guide only when the work changed a durable local fact. When a guide
remains accurate, record that result through the active guide-maintenance check
instead of manufacturing a documentation edit.

Remove generated or inheritance-only guides from directories that own no files.
Preserve a substantive guide when it defines a durable boundary for child
owners. Complete every pending guide-maintenance operation before claiming the
turn is done.

## Reference Map

- The repository's settings file supplies project membership.
- Root and nearest `AGENTS.md` files supply scoped repository instructions.
- Task definition scripts and captured proof outputs supply implementation-task
  evidence.
- Dependency reports, public-API checks, focused tests, Gradle tasks, generation
  checks, and installed-product observations supply verification evidence.

These authorities are roles, not fixed filenames beyond the task evidence and
`AGENTS.md` contracts. Repositories may use different concrete tools.

## Conflict Handling

Explicit local repository instructions may narrow this standard when the local
platform, build, generated contract, or compatibility policy requires it. The
local rule must name the authority and proof. It must not weaken task evidence,
dependency direction, or generated-source ownership by omission.

If the repository has no session workflow, select a session-scoped untracked
directory. If it has no architecture or guide-maintenance check, add the
narrowest rerunnable check that proves the affected rule.

## Anti-Patterns To Reject

| Anti-pattern | Required correction |
|---|---|
| Remembered module topology | Derive membership and ownership from current manifests |
| Root project used as shared domain code | Keep the root as orchestrator and introduce an owned module |
| Framework or adapter dependency in a pure module | Reverse the dependency through a domain-owned contract |
| Complete implementation graph spread across modules | Select bindings in one minimal integration module |
| Verbal red or green claim | Capture the executable task authority and its current proof output |
| Child guide that repeats its parent | Keep only the local delta or move the rule to the common owner |
| Placeholder guide in a grouping directory | Inherit the nearest substantive guide |
| Generated output edited directly | Change the authored source and regenerate |
| Unit tests presented as installed-product proof | Exercise the installed public entry point or state the limit |
| Broad build used as the only evidence | Run the focused proof and widen according to the changed contract |

## Self-Audit

- Does the settings file agree with the documented project and owner map?
- Do pure modules expose only domain-owned contracts, values, and finite
  failures?
- Is the complete implementation graph selected in one minimal integration
  module?
- Can a rerunnable architecture check detect implementation leakage?
- Does every implementation task have five definition files and current red and
  green proof outputs?
- Did every changed path receive both root and nearest local instructions?
- Are local guides substantive deltas rather than copied parent policy?
- Are source authorities and generated outputs explicit?
- Was installed public behavior checked when the shipped artifact changed?
- Did verification widen only as far as the changed contract required?
