# Workflow guidance and runtime resources

This decision is for maintainers composing workflow packages and automatic
checks. Use a full skill reference when the user needs its procedure. Use a
resource reference when a consumer needs one executable or data file.

## Decision

A hook previously had to depend on an entire skill to receive its executable
helper. That dependency also packaged the skill's discovery entry and guidance.
The source graph now has a `RESOURCE` variant for one authored file. Its
identity, dependencies, bytes, mode, and digest remain part of the checked graph.
It adds no `SKILL.md` or skill listing to a consumer's package.

This boundary follows the public guidance on focused workflows and progressive
disclosure. OpenAI describes skills as repeatable procedures with optional
scripts, references, and assets. The skill standard defines discovery and
local resources.
[OpenAI skills](https://developers.openai.com/plugins/concepts/skills),
[Agent Skills specification](https://agentskills.io/specification).
The resource variant is a local authoring decision inferred from that guidance.
It is not a new lab requirement or provider manifest feature.

## Resource contract

Declare the resource once in `source/adaptable.marketplace.json`. A plugin may
select it through `resources`, or a primitive may reference it through
`dependsOn`. Resource dependencies may contain only resources. Other primitive
kinds retain their existing dependency choices.

```json
{
  "type": "RESOURCE",
  "name": "pkl-agent-runtime",
  "source": { "type": "LOCAL_SOURCE", "path": "./" },
  "path": "skills/pkl-engineering/scripts/pkl_agent",
  "dependsOn": [
    {
      "type": "RESOURCE",
      "name": "pkl-agent-runtime-lock",
      "source": { "type": "LOCAL_SOURCE", "path": "./" },
      "path": "skills/pkl-engineering/scripts/pkl_agent.lock"
    }
  ]
}
```

The path names one regular file under a skill's `scripts/` or `assets/`, or
under `source/schemas/`. It excludes directory copies, symlinks, traversal,
empty segments, and any case variant of `SKILL.md`. The projector preserves
the authored path inside each bundle. There is no destination alias.

The [JSON contract](../source/schemas/primitives/resource-reference.schema.json)
refines the reference before graph traversal. Filesystem checks prove that
the file exists and has no symlink ancestor. The closed Pkl asset union proves
the projection shape. Frozen reads and digest sealing preserve the payload
through publication. Repeated references to one identity are idempotent;
conflicting definitions and dependency cycles remain failures.

Keep a skill dependency when the consumer requires the workflow guidance.
Do not replace a real instructional requirement merely to reduce discovery.
Shared helpers stay in their canonical authored folder; no payload moves or
second implementations are needed.

## Pkl composition

Developer Tooling includes the single Pkl Engineering skill and no automatic Pkl hooks.
Pkl Engineering owns configuration contracts, tool setup, source evidence, and modeling references.
Both Pkl profiles now select Software Engineering and Developer Tooling.
The historical `pkl-checked-repository` identifier no longer selects automatic checks.

The three Pkl hooks remain standalone source primitives.
A repository can compose them explicitly with the `pkl-agent-runtime` resource.
The focused tests use a disposable composition to prove resource-only delivery.
They add no wrapper to the shipped marketplace.

The helper is a Python program. The hooks use uv with locked Python scripts.
The `pkl-agent-runtime` resource depends on `pkl-agent-runtime-lock`.
Both files reach the same scripts directory. Locked execution rejects missing or stale locks.
The helper needs a separate Pkl `>=0.31.1,<0.34.0` executable through `PKL_BIN` or `PATH`.
The repository projector needs exactly Pkl 0.32.0.
Evaluation hooks need explicit modules in `.intelligence/pkl-entrypoints`.
Hooks skip when their input scope contains no eligible files.
A skipped hook proves no evaluation or test result.

## Historical compatibility bundles

The marketplace retired `pkl-configuration`, `pkl-workflows`, and `pkl-repository-checks`.
Software Engineering supplies the policy from the retired Engineering Excellence plugin.
The current profiles select the surviving owners and contain no automatic Pkl hooks.


## Evidence and limits

Both provider projections preserve the executable's bytes and mode. The disposable runtime-only
fixture contains no skill entry point. Developer Tooling declares no hooks.
Tests execute each projected evaluation hook command against actual Pkl:
a valid module completes, a type error fails, and a missing helper fails.
Failure output is bounded and excludes the fixture's private source text.

These checks establish packaging and configured command execution. Native host
discovery, hook activation, model routing, and token use still need separate
observations. New routing cases are expected contracts, not observed model runs.
The existing provider compatibility fixtures remain unchanged.

Catalog JSON moves to schema v3 because its closed asset-kind union now includes
`RESOURCE`. Update consumers before reading this report; v1 and v2 reports are
rejected by the v3 schema. Profile contracts retain their versions.

Run the focused check with the pinned runtime:

```sh
PKL_BIN=/absolute/path/to/pkl-0.32.0 node --test tools/tests/workflow-resources.test.mjs
node tools/validate-source-graph.mjs
```

Then run both fresh provider projections and the required repository checks.
Other workflow/integration splits can reuse this boundary after their actual
runtime dependencies have been traced. See the
[redesign direction](skill-plugin-reassessment.md) and
[migration ledger](../source/MIGRATION.md#plugin-replacements).
