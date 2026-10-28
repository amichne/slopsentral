# Repository-owned Pkl projection

The typed asset union also supports a `RESOURCE` for one authored file. It
preserves the file's source path, bytes, mode, and digest without a skill entry
point. See [workflow resources](workflow-resources.md) for the contract and
the Pkl workflow/check split. Existing provider compatibility fixtures remain fixed.

This document guides maintainers changing a provider mapping or generating a
marketplace. The projector supports Codex, GitHub Copilot, and Amp directory
plugins. Authored assets remain under `source/`; plugins compose them by reference.

## Evaluate, seal, publish

1. The Node boundary freezes regular file bytes and modes, then validates the
   source graph against those exact bytes. It resolves references through the existing catalog dependency
   closure. Conflicting identities, missing assets, and cycles remain failures.
2. `Decode.pkl` refines the normalized JSON into `Schema.pkl` types. Asset variants
   require their own data: an agent carries text; a hook carries its adapter.
   Unknown fields and unsupported variants fail evaluation.
3. `Project.pkl` maps that input to typed `Targets.pkl` manifests and a file plan.
   It owns provider names, metadata, hook commands, and agent transformations.
4. Node materializes the plan in memory and hashes the resulting payloads. Pkl
   evaluates again with those hashes to seal provenance. Node proves that sealing
   preserves payload bytes and that every reference digest matches its target.
5. Node checks source freshness, writes the complete tree into a sibling staging
   directory, and publishes it with an atomic no-replace rename. An existing
   file, directory, or symlink wins over the new output. Competing writers admit
   exactly one complete tree. Failure removes only the owned staging directory.

Pkl evaluation cannot fetch remote modules, read ambient environment variables,
or use project settings. Its module root is an isolated copy of the versioned models.
Its resource allowlist permits only the frozen input and two explicit properties.
It has a 60-second limit. Projection never downloads a runtime.
The CLI restrictions follow [Pkl's evaluator controls](https://pkl-lang.org/main/0.32.0/pkl-cli/index.html).

Publication requires Python 3 and a supported native operation. macOS uses
`renamex_np` with `RENAME_EXCL`; Linux uses `renameat2` with `RENAME_NOREPLACE`.
Unsupported systems or filesystems fail closed; there is no replacing fallback.
See [Apple's flag definition](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/stdio.h)
and [Linux rename documentation](https://man7.org/linux/man-pages/man2/rename.2.html).

## Runtime and commands

Use a Git checkout with a resolvable HEAD and install locked Node dependencies.
Node.js 20.11 or later, Python 3, and Pkl 0.32.0 are required. The runtime lock
records SHA-256 digests for macOS and Linux on ARM64 and x64. Setup verifies the
bytes before publishing the executable. It rejects an existing destination.

```bash
npm ci
node tools/install-projection-pkl.mjs --out /tmp/slopsentral-pkl/pkl
export PKL_BIN=/tmp/slopsentral-pkl/pkl
node tools/project-marketplaces.mjs --source . --harness codex --out /tmp/codex-new
node tools/project-marketplaces.mjs --source . --harness github-copilot --out /tmp/copilot-new
node tools/project-marketplaces.mjs --source . --harness amp --out /tmp/amp-new
npm run verify
```

Use fresh output paths with an existing parent directory. Output must be outside
the source repository. Generated provider trees sit beneath the output directory. The CLI
returns a `PROJECTED` receipt on stdout or a finite `PROJECTION_REJECTED` outcome
on stderr. Outcomes identify the stage and failure code. Pkl diagnostics retain
only a known model filename and line, or `EVALUATION_FAILED`; they exclude source
text and raw subprocess logs.

## Determinism and provenance

The inputs are frozen source bytes and modes, the repository's HEAD commit time,
the versioned models, and the pinned evaluator. Identical inputs produce identical
bytes and executable modes. No current time or random identifier enters output.
Temporary directory names do not enter generated files.

`marketplace-lock.json` preserves projected reference hashes and `generatedAt`.
Its compatibility field `sourceSha` hashes canonical source files in sorted order,
using relative path, NUL, bytes, and NUL. It excludes `.git`, `.gradle`, `.idea`,
`__pycache__`, `build`, `dist`, `target`, and `.pyc` files. It is a source-tree hash,
not a Git commit ID, model digest, or proof of host activation. Source symlinks
and non-regular resources are rejected.

## Compatibility and supported scope

Before adding the new catalog entries, the Pkl output was compared with pinned
projeKtor v1.2.1 at reuse commit `33b2581eb6758bd39f2b51e4b6b517e79d402da7`.
The comparison covered 397 Codex files and 403 GitHub Copilot files. It found no
missing files, extra files, payload differences, or executable-mode differences,
after excluding only the lock's `sourceSha`. That hash intentionally excludes
local caches; the old projector included them. Every other lock field matched.

Checked-in compatibility fixtures preserve representative manifests, agents,
instructions, hooks, and MCP delivery. Native regression tests compare complete
repeated projections and every copied skill payload. They also test incomplete
plans, changed source, symlinks, corrupt runtime downloads, and competing writers.
These checks prove generated behavior. They do not prove installed host behavior
or better model routing.

Only repository-local plugins and assets are supported. Remote marketplaces and
provider overrides are explicit unsupported states. A new target or source
extension requires typed models, positive and negative tests, and qualification.
Do not weaken rejection to approximate an unknown shape.

The existing publication workflow still publishes both generated trees together
on `main` and each harness branch from validated source. The projector replacement
does not grant publication authority or change installed caches.

## Amp native plugins

`--harness amp` produces `.amp/plugins/<bundle>/index.js` with complete skills,
scripts, references, and instructions. Copy selected complete bundle directories
into a consumer project's `.amp/plugins/` without overwriting existing plugins.
Start with `software-engineering`, adding `kotlin-engineering` for Kotlin work.
Reload plugins after installation. Do not install only an `index.js` URL.

Publication targets `harness/amp` and retains a `marketplace-amp` workflow archive.
Amp output is absent from `main` so checking out source does not activate every
bundle. After the first successful publication, obtain the prebuilt payload:

```bash
git clone --single-branch --branch harness/amp \
  https://github.com/amichne/slopsentral.git /tmp/slopsentral-amp-published
git -C /tmp/slopsentral-amp-published rev-parse HEAD
git -C /tmp/slopsentral-amp-published log -1 --format=%B
```

Record the revision and its `Source-Commit` trailer with the installation.
The branch advances; a recorded commit identifies exact bytes.
User-local installation in `~/.config/amp/plugins/` is also supported by Amp.
Choose one scope. Global User/Workspace Plugins repositories require a separate,
authorized copy of complete bundles and publication through Amp's repository workflow.

### Updates and rollback

1. Obtain the new payload in a fresh directory and review its revision and diff.
2. Stop active Amp sessions using this installation. Move each selected old
   bundle to a backup **outside all Amp plugin discovery roots**.
3. Copy complete replacements into the vacant destinations. Never merge new
   files into old directories; removed files must disappear. Keep unrelated plugins.
4. Start Amp or reload plugins. Check `amp plugins list` and
   `amp skill info software-engineering:semantic-ratchet`, substituting a
   qualified skill from each selected bundle.
5. If installation fails, stop the affected sessions, remove only the new
   bundle, restore its backup, and reload. Keep backups until verification succeeds.

This is manual, session-stopped replacement, not an atomic live updater.
`amp plugins update` does not update copied directories. Uninstall by removing
only selected bundles and reloading. Commands still need their documented tools;
schema `validate`, for example, requires the consumer's locked Ajv dependencies.

### Capability and evidence limits

Skills register as `<bundle>:<skill>`. Shared skills can appear under two names;
both copies come from the canonical source. Choose bundles deliberately.
Each bundle's typed `capabilities.json` declares these boundaries:

| Capability | Amp behavior |
| --- | --- |
| Skills and resources | Native registration with the full directory layout |
| Instructions | Installed files supplied through `agent.start` on every turn |
| Hooks, agent profiles, MCP configuration | Reference material only; no execution, custom modes, or connections |
| Workflow profiles and hook policies | Unsupported; choose installed bundles instead |

Missing instruction files fail initialization before skill registration.
Package context grants no authority and does not supersede repository rules.
Pi installation remains owned by its [published installer](pi-install.md).
The same projector also supports `--harness pi` for native packages across all five plugins;
that separate adapter does not alter Amp or restore the retired Pi runtime.

`npm run verify:marketplaces` exercises generated adapters and installed scripts
for all three targets. To additionally check native Amp discovery, run:

```bash
AMP_BIN="$(command -v amp)" PKL_BIN=/path/to/pkl \
  node --test tools/tests/amp-projection.test.mjs
```

Adapter tests inspect instruction content. The native event command proves
loading and execution but does not expose that content. CI runs adapter tests;
native Amp discovery requires `AMP_BIN` and is not a CI gate. Neither check
measures model routing, instruction adherence, or task outcomes.
