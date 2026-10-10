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
scripts, references, and assets. Anthropic recommends concise discovery and
executable helpers for deterministic work.
[OpenAI skills](https://developers.openai.com/plugins/concepts/skills),
[Anthropic skill authoring](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).
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
  "path": "skills/pkl-engineering/scripts/pkl_agent"
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

## Pkl pilot

| Package | Contents | Selection |
| --- | --- | --- |
| `pkl-workflows` | Four existing Pkl skills | Develop, inspect, and maintain Pkl configuration |
| `pkl-repository-checks` | Three existing hooks and the `pkl-agent-runtime` resource | Add automatic format, evaluation, and test checks |
| `pkl-configuration` | The same four skills and three hooks | Retain the complete compatibility bundle |

`pkl-workflow-default` selects the workflow package with Software Engineering
and Engineering Excellence. `pkl-checked-repository` also selects Pkl Repository
Checks. Existing profiles retain their selections. Evaluation still requires
repositories to name modules in `.intelligence/pkl-entrypoints`.

The bundled helper is a Python program, not the Pkl binary. Checks require
Python 3 and Pkl `>=0.31.1,<0.34.0` available through `PKL_BIN` or `PATH`.
Installing the package does not install either tool. The repository projector
has its separate, exact Pkl 0.32.0 requirement.

All checks skip without changed Pkl-owned files. Evaluation skips without
explicit entrypoints. Testing skips without a `PklProject` or changed
`.test.pkl` or `_test.pkl` files. Formatting skips without changed `.pkl`
files or `PklProject`. A skipped hook proves no evaluation or test result.

After publication, choose the two new packages or the compatibility bundle.
A profile selecting both `pkl-configuration` and `pkl-repository-checks` fails
because it would activate the same hooks twice. Source edits do not migrate
installed caches, configuration layers, or hook trust.

The Pkl hooks now depend on the executable resource rather than whole skills.
Their scripts and provider commands retain their behavior. The combined new
closures preserve every asset in the compatibility bundle's closure.

## Evidence and limits

Both provider projections preserve the executable's bytes and mode. The checks
package contains no skill entry point; the workflow package declares no hooks.
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
[migration ledger](../source/MIGRATION.md#pkl-workflow-and-resource-pilot).
