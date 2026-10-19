# Pi content-profile trial

The trial compiles `kotlin-type-design` into a Pi package with four skills and one scoped instruction.
Canonical skill files keep their source bytes.
The package declares only `pi.skills` and needs no runtime dependency.

This authoring path implements delivery step A of the native-primitives plan.
The default projection and public release path still use the existing extension package.
No runtime module or persisted review record changes in this step.

## Compile and select the profile

Use Pkl 0.32.0 with the Python projector from the repository root.
Choose an output directory that does not exist.

```sh
uv run --locked tools/marketplace.py project \
  --source . --harness pi --profile kotlin-type-design \
  --out /tmp/slopsentral-content-trial
```

The `--profile` option selects files during authoring.
It adds no Pi flag, command, tool, or session state.
The selected skills are `kotlin-design-practices`, `kotlin-review`, `negative-capability-proof`, and `semantic-ratchet`.
Pi uses its native package mechanism:

```sh
pi install /tmp/slopsentral-content-trial/.pi/slopsentral
```

Pi does not discover an instruction file inside an installed package.
The generated `AGENTS.md` contains the canonical Kotlin instruction.
Deploy that file into the intended project scope through the normal file deployment process.
For an existing `AGENTS.md`, include the instruction once within its current scope.
Keep personal deployment under dotfiles ownership.
Start a new Pi session after native resource selection changes.

The native contracts appear in the [Pi package guide](https://pi.dev/docs/latest/packages) and [Pi skill guide](https://pi.dev/docs/latest/skills).
The [Agent Skills specification](https://agentskills.io/specification) owns the portable skill format.

## Examine the generated files

`profile-inventory.json` records the selected profile, source identities, target paths, source digests, and supported invocation mode.
Its contract lives in `source/schemas/pi/content-profile.schema.json`.
`marketplace-lock.json` keeps the existing source and payload provenance.
Each skill digest covers its folder, with relative file paths and bytes in sorted order.
The instruction file joins selected canonical instructions in stable source order.

The trial supports `either` invocation.
It rejects `human` and `model` restrictions until separate native compatibility evidence supports their projection.
It rejects `ADVISORY` and `ENFORCING` hook policies with `UNSUPPORTED_CAPABILITY`.
An `OFF` policy explicitly excludes the selected plugins' hooks.
Unsupported requests produce no output directory.

Package admission rejects runtime declarations, runtime peer dependencies, missing skill files, repeated skill paths, and paths outside selected skill roots.
Archive creation uses the existing deterministic packager and version override.
Release candidate admission and promotion remain under their existing owners.

## Classify the previous runtime guarantees

These classifications apply to the content-profile trial.
The existing extension modules remain in source for the later migration.

| Previous surface and source owner | Trial classification | Replacement or removed guarantee |
| --- | --- | --- |
| Skill catalog and `skills.ts` | Native replacement | Pi discovers the selected skills. No Slopsentral loader or admission token exists. |
| Profile commands, aliases, and flag in `slopsentral.ts` | Native replacement | Package settings select files before a session starts. In-session profile changes end. |
| Instruction injection in `slopsentral.ts` | Native replacement | A deployed `AGENTS.md` uses Pi's project scope. Package installation alone supplies no instruction. |
| Invocation restrictions in `skills.ts` | Removed from trial | Only `either` works. Other restrictions fail during projection. |
| Settings precedence and branch restoration in `settings.ts` and `control.ts` | Removed from trial | No mutable profile layer, session overrides, or branch-local restoration exists. |
| Settings UI in `menu.ts` | Native replacement | Pi owns package and resource configuration. Slopsentral adds no menu. |
| Scope obligations and review records in `journal.ts` and `control.ts` | Removed from trial | No mutation journal, review obligation, or blocking review receipt exists. Existing records remain untouched. |
| Hook execution and output handling in `runtime.ts` and `control.ts` | Removed from trial | No input interception, tool-result transform, context injection, or silent diagnostic hook exists. |
| Completion gates in `slopsentral.ts` | Removed from trial | No pre-settlement gate, automatic continuation, or manual gate command exists. |
| Ordering and cancellation in `coordinator.ts` | Removed from trial | No Slopsentral scheduler, queue, deduplication, cancellation, or completion guarantee exists. |
| Status and notifications in `control.ts` | Removed from trial | Pi owns native diagnostics. No Slopsentral status protocol exists. |
| External semantic tools | Separate provider | Kast owns semantic tools and their host integration. The trial adds no MCP server or tool catalog. |

Skills provide procedures and guidance.
They do not establish a blocking gate, action permission, completed review, or model compliance.
Local repository tasks and CI can supply executable evidence through ordinary host tools.

## Executable evidence and limits

The source baseline is Slopsentral `e97040c2ca304a24b779036b757ca349731eacda`.
The remote dotfiles head is `8da93dc24aa3a32865acbb01bdbc1101bfe900a0`.
The native host evidence uses Pi 1.3.0 from the locked Node dependencies.

```sh
PKL_BIN=/path/to/pkl-0.32.0 node --test tools/tests/pi-content-profile.test.mjs
PKL_BIN=/path/to/pkl-0.32.0 uv run --locked pytest \
  tools/python_checks/test_native_marketplace.py \
  tools/python_checks/test_package_pi.py
```

The host test uses a disposable home, Pi configuration, project, and npm cache.
It installs the archive from a local HTTP server with registry access disabled.
It compares installed files with projected files and canonical source.
It examines exact skill discovery, native instruction delivery, and absent Slopsentral registrations.
It makes no model request and proves no model compliance.

The Python cases examine unsupported capabilities before publication and unsafe package admission.
The normal Pi candidate job also runs the native host test through its existing `pi-*.test.mjs` selection.
Public release promotion, personal dotfiles deployment, other invocation modes, and native hook compatibility remain later delivery steps.
