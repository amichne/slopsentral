# Repository-owned Pkl projection

The typed asset union also supports a `RESOURCE` for one authored file. It
preserves the file's source path, bytes, mode, and digest without a skill entry
point. See [workflow resources](workflow-resources.md) for the contract and
the Pkl workflow/check split. Historical compatibility fixtures remain in pinned Git archives.

This document guides maintainers changing a provider mapping or generating a
marketplace. The projector supports Codex, GitHub Copilot, and an installable Pi package.
Authored assets remain under `source/`.
Plugins compose them by reference.
See [the Pi harness guide](pi-harness.md) for its native content contract and setup procedure.

## Evaluate, seal, publish

1. Python freezes regular file bytes, modes, and digests.
2. `Source.pkl` resolves canonical references and profile selections from those bytes.
3. `Decode.pkl` refines the input into `Schema.pkl` types.
4. `Project.pkl` produces typed provider manifests and explicit file operations.
5. Python materializes the plan in memory and computes payload hashes.
6. Pkl seals provenance with those hashes. Python examines payload identity and every reference digest.
7. Python examines source freshness and writes the complete tree into a sibling directory.
8. The native rename publishes that directory without replacing an existing target.

The Python adapter owns file and process effects.
Pkl owns composition and provider shapes.
The retained JavaScript projector and audits supply compatibility evidence outside the core path.
Pi and Mintlify use their own Node.js runtimes.

Pkl evaluation cannot fetch remote modules, read ambient environment variables,
or use project settings. Its module root is an isolated copy of the versioned models.
Its resource allowlist permits only the frozen input and the named input, snapshot, and harness properties.
It has a 60-second limit. Projection never downloads a runtime.
The CLI restrictions follow [Pkl's evaluator controls](https://pkl-lang.org/main/0.32.0/pkl-cli/index.html).

Publication requires Python 3 and a supported native operation. macOS uses
`renamex_np` with `RENAME_EXCL`; Linux uses `renameat2` with `RENAME_NOREPLACE`.
Unsupported systems or filesystems fail closed; there is no replacing fallback.
See [Apple's flag definition](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/stdio.h)
and [Linux rename documentation](https://man7.org/linux/man-pages/man2/rename.2.html).

## Runtime and commands

Use a Git checkout with a resolvable HEAD, Python 3.12 or 3.13, and Pkl 0.32.0.
Core projection needs no Node.js executable. The runtime lock
records SHA-256 digests for macOS and Linux on ARM64 and x64. Setup verifies the
bytes before publishing the executable. It rejects an existing destination.

```bash
uv run --locked tools/install_projection_pkl.py --out /tmp/slopsentral-pkl/pkl
export PKL_BIN=/tmp/slopsentral-pkl/pkl
uv run --locked tools/marketplace.py project --source . --harness codex --out /tmp/codex-new
uv run --locked tools/marketplace.py project --source . --harness github-copilot --out /tmp/copilot-new
uv run --locked tools/marketplace.py project --source . --harness pi --out /tmp/pi-new
uv run --locked tools/marketplace.py validate
uv run --locked tools/verify_marketplaces.py
```

Use fresh output paths with an existing parent directory. Output must be outside
the source repository. Generated provider trees sit beneath the output directory. The CLI
returns a `PROJECTED` receipt on stdout or a finite `PROJECTION_REJECTED` outcome
on stderr. Outcomes identify the failure code. Pkl diagnostics keep
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

Historical Git archives preserve representative manifests, agents, instructions, hooks, and service configuration. Native regression tests compare complete
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
