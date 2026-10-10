# Task-Oriented Plugin Migration

The earlier task-oriented migration retired old plugin IDs without aliases.
The [tooling redesign pilot](#tooling-redesign-pilot) below adds alternatives
and retires no current entry.
Canonical skills, agents, hooks, and instructions keep their identities and
retain one canonical source. Publication and installed-session activation are separate
from editing or projecting this source catalog.

## Plugin choices

| Previous plugin | Replacement |
| --- | --- |
| engineering-baseline | software-engineering + engineering-excellence |
| effective-delivery | software-engineering |
| developer-tools | software-engineering for everyday Git, shell safety, data queries, and mise; personal-setup for CLI authoring and shell integration |
| terminal-ui-design | personal-setup |
| agent-platform-authoring | personal-setup |
| code-knowledge-base | repository-knowledge |
| cli-development, agent-tooling | personal-setup |
| technical-writing | repository-knowledge |
| intellij-engineering | intellij-plugin-development |
| pkl-engineering | pkl-configuration |
| writing | repository-knowledge |
| kotlin-engineering, api-contracts | Same IDs; clearer task descriptions |
| skill-read-policy | Same ID; advanced opt-in, outside ordinary task choices |

Software Engineering includes local implementation and delivery capabilities.
A local edit, ticket, or linked deliverable does not itself authorize a push or
PR. Publication follows the user's requested end state or applicable repository
policy. RED/GREEN checkpoints do not require commits or remote publication.

## Profiles

| Profile | Selected plugins |
| --- | --- |
| local-development-default | software-engineering + engineering-excellence |
| kotlin-repo-default | software-engineering + engineering-excellence + kotlin-engineering |
| intellij-plugin-default | software-engineering + engineering-excellence + kotlin-engineering + intellij-plugin-development |
| documentation-default | repository-knowledge |
| agent-authoring-default | software-engineering + engineering-excellence + personal-setup |

Repository Knowledge is optional. Documentation alone no longer installs
engineering hooks. Profiles retain their names so callers can select the same
workflow; their plugin compositions change deliberately.

After the new provider marketplace is published, refresh it and install the
replacement IDs. Disable retired IDs in every applicable user, project, and
named-profile configuration, then re-apply the desired profile and review its
hooks. The profile lifecycle reconciles the current catalog; it does not migrate
retired IDs in unrelated configuration layers.
Old and replacement plugins should not remain enabled together.

No installed cache, user configuration, hook trust state, or remote marketplace
is changed by this source migration. Standalone skill installation remains an
advanced alternative, not a prerequisite for the normal plugin chooser.

## Tooling Redesign Pilot

This slice adds alternatives; it retires no existing identity. Personal Setup
0.3.1 retains its skills and source-check hook. Its hook metadata no longer
advertises two authoring skills as executable dependencies. The script and
provider adapter are unchanged. The complete source graph remains authoritative.

| Canonical assets | Existing consumer | New consumer | Evidence required |
| --- | --- | --- | --- |
| CLI, shell, terminal, skill, agent, hook, plugin, routing, and instruction authoring skills | Personal Setup | Developer Tooling | Both projections preserve canonical skill bytes; real tasks must establish routing and useful results |
| `personal-setup-management`, `personal-cli-authoring` | Personal Setup | Personal Configuration | Same source paths and constraints; no live personal configuration migration |
| `shell-session-integration`, `shell-script-safety` | Personal Setup; shell safety also in Software Engineering | Both pilot bundles | Shared canonical identity is allowed; host discovery deduplication remains unproven |
| `source-graph-valid` hook | Personal Setup | Repository Source Checks | One hook in the profile closure; projected scripts and native Stop contract |

All asset identities and paths stay fixed. No payload moves or upstream skills
become local canonical assets. New plugins reference existing assets. The only
removed edges are the source hook's instructional dependencies; its executable
uses the repository validator, not those skills. Legacy Personal Setup continues
to select both skills directly.

`developer-tooling-default` selects Software Engineering, Engineering Excellence,
Developer Tooling, and Repository Source Checks. `personal-configuration-default`
selects only Personal Configuration. Existing profiles keep their selections.
The two workflow bundles have no hooks or MCP declaration of their own.

After publication, select a pilot instead of overlapping legacy installation
where the old hook would execute again. Selecting Personal Setup together with
Repository Source Checks fails profile validation. Identical shared skills are
allowed, but inspect host discovery entries before assuming they collapse.
Source edits and generated package checks do not change installed caches,
configuration layers, or hook trust. Do not retire the compatibility bundle
until fresh sessions and task comparisons qualify its replacements.

The first three benchmark definitions audit composition boundaries. Their golden
routing fixtures are contracts, not observed model runs. CLI creation, completion,
agent authoring, and personal installation remain required task comparisons.
See [the redesign](../docs/skill-plugin-reassessment.md) and
[Pkl qualification](../docs/pkl-projection.md).

## Pkl Workflow and Resource Pilot

Pkl Workflows 1.0.0 packages the four existing Pkl skills. Pkl Repository
Checks 1.0.0 packages the three existing Pkl hooks and their executable helper.
Pkl Configuration 1.0.3 retains the complete composition for existing callers.
No skill, executable, adapter, or current profile selection is retired.

The hooks now depend on one `RESOURCE`, `pkl-agent-runtime`, instead of whole
skills. It references the existing `pkl-engineering/scripts/pkl_agent` file.
Both projections preserve its bytes and executable mode. The combined new
closures contain every asset selected by the compatibility composition.

`pkl-workflow-default` selects Software Engineering, Engineering Excellence,
and Pkl Workflows. `pkl-checked-repository` adds Pkl Repository Checks.
After publication, choose the new packages or Pkl Configuration. A profile
selecting the compatibility bundle with the new checks rejects duplicate hooks.
Installed caches, configuration layers, and hook trust require explicit host
selection; source edits do not migrate them.

The source catalog now has 14 compositions and 66 skills. Catalog report v3
extends the closed asset-kind union with `RESOURCE`; update report consumers.
Profiles retain their current schema versions. Expected routing fixtures cover
the new selections. Actual projected commands pass valid Pkl and reject a type
error or a missing helper. Native host activation and model behavior remain
unobserved for this pilot. See [workflow resources](../docs/workflow-resources.md).

## Engineering Excellence Extraction

Software Engineering 1.4.0 transfers Semantic Ratchet and the engineering-design
policy to Engineering Excellence 1.0.0. The canonical skill and instruction paths
remain stable, and each primitive retains its canonical source. Standard code profiles
select both plugins so they retain the earlier capability. Documentation-only
profiles continue without engineering policy.

After publication, update Software Engineering and install Engineering Excellence
together, then review `engineering-excellence-context` through the host's hook
interface. The Software Engineering context hook now delivers agent-execution
only; the new context hook delivers engineering-design. An existing older
Software Engineering installation may still deliver the old policy until updated.
The source change neither modifies installed caches nor changes hook trust.

## Retiring The Global CLI

Software Engineering 1.1.0 removes the `repository-profile` startup hook.
The `slopsentral` npm binary and `context` launcher are retired. Select plugins
through the host marketplace. Version 1.2.0 adds a read-only context hook for
canonical instructions. No global Slopsentral process is required to inject
guidance.

Kotlin Engineering 1.5.0 and API Contracts 1.1.0 use the same context contract.
The instruction primitives keep their identities and bytes; their install edges
move from direct plugin references to hook dependencies. Refresh the marketplace,
update the plugins, and review the new hook definitions through `/hooks`.
Existing trust does not approve a changed hash. Disabled, unsupported, or
untrusted hooks provide no policy guarantee; the skills remain self-contained.
Plugin-level `AGENTS.md` links alone were packaging evidence, not established
model-context delivery.

Software Engineering 1.2.0 also retires `agents-md-turn-refresh`. Its automatic
turn tracking wrote `.agent-turn/` even during tasks that requested no file
changes. The default plugin now has only the read-only context hook. Instruction
topology changes remain explicit work through the Agent Tooling skill. Saved
tracking files are user state; this migration does not delete them automatically.

After publication, refresh the marketplace and update Software Engineering to
remove the old installed hook. An already-installed global CLI is not removed by
this source change. Once the plugin is updated, remove that package with:

```bash
npm uninstall --global slopsentral
```

Uninstallation preserves existing profiles, repository configuration, and backups.
The optional checkout-local [profile lifecycle](../docs/profile-lifecycle.md)
retains explicit plan/apply/status operations and verified rollback. To reverse a
saved CLI transaction, run from a checkout with `npm ci` completed:

```bash
node tools/profile-lifecycle.mjs rollback \
  --transaction /absolute/path/to/manifest.json \
  --backup-root /absolute/path/to/backups/slopsentral
```

Use the original backup root and exact saved manifest. Rollback refuses to change
a target that no longer matches its recorded after-image. New workflow profiles
reject the retired `activation` field; saved repository-profile transactions
remain supported by the transaction schema.

## Earlier primitive migrations

The earlier git-ci-operations plugin is superseded by Software Engineering.
Primitive migrations remain: gh-fix-ci to github-ci-operations; doc-coauthoring
to technical-documentation; skill-creator to skill-primitive-authoring;
jira-resolve-ticket to issue-tracker-operations. Prose-only edits use
controlled-technical-writing. Required skill reads belong only to the opt-in
skill-read-policy plugin. Placeholder migration skills stay retired.

## Evidence

The reuse baseline had 9 plugins: one default, seven specialties, and one
advanced policy. The tooling pilot adds two specialties and one advanced
integration, bringing the source catalog to 12. Removing automatic repository activation preserves the skill and
instruction owners; the retired startup hook is no longer in the install closure.
Regression checks cover the task selections, canonical identity, profile lifecycle,
and provider inputs. Renamed routing fixtures remain expected contracts, not
fresh model observations. Benchmark scenarios are retained under their new
plugin owners; authored additions require live execution before behavior claims.

Use Plugin Eval on the projected Codex plugins, where its manifest format applies.
Its static budget estimates and heuristic findings do not establish runtime
loading or token savings. Keep generated output and raw evaluator reports outside
the source branch. See [upstream guidance](UPSTREAM.md) for the design rationale.

## Shared Asset Composition

Plugins may now compose the same canonical skills, agents, hooks, and instructions.
Personal Setup 0.3.0 reuses shell-script-safety from Software Engineering and
manage-json-schemas from API Contracts. Their source paths and names stay stable.
The earlier Personal Setup and Repository Knowledge consolidations remain intact.
No routine or role is renamed for packaging alone.

Profiles may select overlapping skills, agents, and instructions. They reject a
hook composed by two selected plugins, even through a dependency. For each shared hook, select one
composing bundle per profile. Hosts still install separate bundles; source
reuse does not establish that the host deduplicates execution or context.

The reuse change introduced catalog report v2. Its `assets` array lists
canonical paths and composing plugins. `totals.instructionWords` counts each
instruction once. Per-plugin counts remain available for separate packages.
The [resource pilot](#pkl-workflow-and-resource-pilot) now requires report v3.

Regenerate provider output after source validation. Refresh installed plugins
through the host after publication; source edits do not change running sessions.
