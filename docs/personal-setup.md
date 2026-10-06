# Personal Setup

The `personal-setup` plugin focuses on `amichne/shell-config` and tools built for
the user's own command-line workflows. It composes two independent skills:

- `personal-setup-management` verifies the current configuration source,
  separate Git directory, installed consumer links and private-state boundary.
- `personal-cli-authoring` builds parameterized tools from reusable operations,
  with offline help, generated completion and source-backed `--teach`.

The verified layout on 2026-10-06 uses `~/.dotfiles.git` with `~/.dotfiles` as the
public worktree. `core.bare` is false. The earlier `~/.cfg`/HOME layout is
historical; the management skill rechecks the wrapper and metadata before edits.

Example requests after selecting the plugin:

> Add a personal file inspection tool to shell-config. Make the root and filters
> configurable, compose its output with jq, generate Zsh completion, and include
> --teach using the exact implementation and the directory I run it from.

> Verify my current config wrapper and completion installer, then register this
> tool through the existing source and consumer-link owner.

## Try the retained building blocks

From the Slopsentral source checkout, run the sample without installing it:

```sh
node source/skills/personal-cli-authoring/assets/personal-size.mjs --help
node source/skills/personal-cli-authoring/assets/personal-size.mjs --min-bytes 1048576 --json
node source/skills/personal-cli-authoring/assets/personal-size.mjs --completions zsh
node source/skills/personal-cli-authoring/assets/personal-size.mjs \
  --teach 'Find large files here and explain how to narrow the output' --teach-preview
```

Preview prints a local JSON packet containing explicit source files and their
hashes, the current directory's visible entry names, an optional question and
history availability. It does not invoke an assistant. Without `--teach-preview`,
the default adapter is the existing `ai ask` command. Tools can replace the
adapter with an executable and repeatable arguments; no shell evaluation is used.

When adapted and installed through shell-config's verified installer, the tool
can be invoked directly:

```sh
personal-size --teach
personal-size --teach 'Show a jq pipeline for the largest files here'
```

The bundled Zsh function connects the parent session's recent history only when
teaching is requested. The helper keeps executable names and removes operands.
Without that connection it reports history as unavailable. It never scans a
private history database. The sample completion is generated from its option
definitions and performs no network work.

Integrate the helper into the existing runtime and pass the exact command and
relevant module paths. Do not link a permanent personal tool into an ephemeral
plugin cache or worktree. This plugin adds the teaching contract to tools it
authors or explicitly extends; existing commands need their own source change
to support `--teach`.

## Verify

```sh
node --test tools/tests/personal-setup-teach.test.mjs
node tools/validate-source-graph.mjs
```

The focused tests cover composition, source-backed context, typed failures,
argument-safe assistant transport, generated completion and parent-shell history.
These are deterministic implementation checks. Routing cases and the benchmark
definition are unobserved model scenarios until run with a live evaluator.

The plugin is authored under `source/plugins/personal-setup`. Provider packages
must be generated with projeKtor before installation; installation and publishing
use the marketplace's existing workflow.
