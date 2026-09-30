# Task-Oriented Plugin Migration

This is a breaking catalog change. Old plugin IDs are retired without aliases.
Canonical skills, agents, hooks, and instructions keep their identities and
remain owned once. Publication and installed-session activation are separate
from editing or projecting this source catalog.

## Plugin choices

| Previous plugin | Replacement |
| --- | --- |
| engineering-baseline | software-engineering |
| effective-delivery | software-engineering |
| developer-tools | software-engineering for everyday Git, shell safety, data queries, and mise; cli-development for CLI authoring and shell integration |
| terminal-ui-design | cli-development |
| agent-platform-authoring | agent-tooling |
| code-knowledge-base | repository-knowledge |
| intellij-engineering | intellij-plugin-development |
| pkl-engineering | pkl-configuration |
| writing | technical-writing |
| kotlin-engineering, api-contracts | Same IDs; clearer task descriptions |
| skill-read-policy | Same ID; advanced opt-in, outside ordinary task choices |

Software Engineering includes local implementation and delivery capabilities.
A local edit, ticket, or linked deliverable does not itself authorize a push or
PR. Publication follows the user's requested end state or applicable repository
policy. RED/GREEN checkpoints do not require commits or remote publication.

## Profiles

| Profile | Selected plugins |
| --- | --- |
| local-development-default | software-engineering |
| kotlin-repo-default | software-engineering + kotlin-engineering |
| intellij-plugin-default | software-engineering + kotlin-engineering + intellij-plugin-development |
| documentation-default | technical-writing |
| agent-authoring-default | software-engineering + agent-tooling |

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

The catalog has 10 plugins: one default, eight specialties, and one advanced
policy. Removing automatic repository activation preserves the skill and
instruction owners; the retired startup hook is no longer in the install closure.
Regression checks cover the task selections, unique ownership, profile lifecycle,
and provider inputs. Renamed routing fixtures remain expected contracts, not
fresh model observations. Benchmark scenarios are retained under their new
plugin owners; authored additions require live execution before behavior claims.

Use Plugin Eval on the projected Codex plugins, where its manifest format applies.
Its static budget estimates and heuristic findings do not establish runtime
loading or token savings. Keep generated output and raw evaluator reports outside
the source branch. See [upstream guidance](UPSTREAM.md) for the design rationale.
