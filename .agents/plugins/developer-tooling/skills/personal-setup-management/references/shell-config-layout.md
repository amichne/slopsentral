# Discover personal setup ownership

This public-source snapshot was reviewed on 2026-11-04. The reference keeps its
historical filename so existing links work. Its paths are discovery leads, not
proof of any machine's installed state. Reopen the actual owners before acting.

## Discover before selecting a layout

Resolve the affected command with the shell's command lookup. Inspect aliases,
functions, launcher bytes and symlink targets before invoking a wrapper. `df`
can also name the system disk-space command; its spelling proves no ownership.
Inspect only the named entrypoint and its necessary dependencies.

Identify the Git directory and worktree separately. Check metadata without a
worktree override first: `rev-parse --is-bare-repository` with `--work-tree` can
report `false` even when `core.bare` is `true`. Read `core.bare` explicitly.
Then use the verified worktree for scoped inventory, status and diffs.
Compare the exact host, owner and repository for SSH or HTTPS origins; substring
matches are insufficient. Inspect revision and branch as well as origin.

Keep inherited `GIT_DIR`, `GIT_WORK_TREE`, index, object-store and Git config
injection variables out of discovery commands. Use the owner's reviewed
environment filtering where available. Disable optional index refresh with
`GIT_OPTIONAL_LOCKS=0` for read-only status. Do not print complete configuration,
private file contents, raw history, credentials or unrelated HOME status.
Unavailable or conflicting identity stops dependent writes, including installs.

## Current Dotfiles source

[Dotfiles README](https://github.com/amichne/dotfiles/blob/0d12a3b0930dd7068c37d0a6f08b261ce936fa68/README.md),
[ownership](https://github.com/amichne/dotfiles/blob/0d12a3b0930dd7068c37d0a6f08b261ce936fa68/docs/repository-instructions.md),
[manager](https://github.com/amichne/dotfiles/blob/0d12a3b0930dd7068c37d0a6f08b261ce936fa68/scripts/df.py)
and [installer](https://github.com/amichne/dotfiles/blob/0d12a3b0930dd7068c37d0a6f08b261ce936fa68/scripts/install.py)
establish this source contract:

| Owner | Responsibility |
| --- | --- |
| `.gitignore` | Default-deny public inventory; confirm tracked paths with Git |
| `.local/bin/df`, `scripts/df.py` and adjacent lock | Named-path Git selection and read-only setup inspection |
| `~/.dotfiles.git` | Bare Git metadata; HOME is the explicitly selected worktree |
| `.zshrc`, `.zprofile`, `.config/zsh/` | Native shell startup, functions and completions |
| `.local/bin/keys`, `.config/shell-prompt/` | Shortcut browser and prompt implementation |
| `scripts/install.py` and adjacent lock | Reviewed committed source to HOME installation and fast-forward updates |
| `.pi/agent/` | Public Pi resources; authentication and sessions remain private |

For a verified native HOME installation, use these metadata reads in a clean
Git environment. This block reads only named public inventory and metadata:

```sh
git --git-dir="$HOME/.dotfiles.git" rev-parse --is-bare-repository
git --git-dir="$HOME/.dotfiles.git" config --get core.bare
git --git-dir="$HOME/.dotfiles.git" remote get-url origin
git --git-dir="$HOME/.dotfiles.git" rev-parse HEAD
GIT_OPTIONAL_LOCKS=0 git --git-dir="$HOME/.dotfiles.git" --work-tree="$HOME" status --short --untracked-files=no -- .zshrc .local/bin/df scripts/df.py scripts/install.py
git --git-dir="$HOME/.dotfiles.git" --work-tree="$HOME" ls-files -- .zshrc .local/bin/df scripts/df.py scripts/install.py
```

Inspect the installed launcher and manager before using `df setup plan --json`.
It checks repository identity and required files without installation. Current
`df` requires bare metadata and an exact supported Dotfiles origin. Missing
metadata or rejected identity is a gap to report, not permission to initialize
or repair HOME. Stage named public paths only; `df git` retains native effects.

The tracked HOME paths are the runtime files, not links into a `runtime/` tree.
An ordinary developer checkout has its own `.git`; inspect it with `git -C`.
It is source evidence, not proof that HOME runs that revision.
The installer plans from a reviewed clean checkout's committed `HEAD`, then
requires an explicit application with its expected plan ID. Plan invalidation,
conflict protection and private recovery belong to that installer. Do not run
application for a source-only task or replace it with bulk copying.

## Current Ayi source

[Ayi README](https://github.com/amichne/ayi/blob/73334f268a1d922086d482676e1d358eb5d508b3/README.md),
[link installer](https://github.com/amichne/ayi/blob/73334f268a1d922086d482676e1d358eb5d508b3/install.py)
and [archive bootstrap](https://github.com/amichne/ayi/blob/73334f268a1d922086d482676e1d358eb5d508b3/bootstrap.py)
own the reusable AI command registry, prompts, installer and tests.
Resolve `~/.local/bin/ayi` and each affected generated command. Inspect the
resolved root's launcher, installer and public command files before editing.

A developer checkout can supply its Git origin and revision. An archive install
uses `${XDG_DATA_HOME:-$HOME/.local/share}/ayi/source` by default, a local Git
registry and `.ayi-source` for its upstream source commit. It need not have an
origin. Compare that marker, the registry revision and the resolved installed
links; they describe different identities. A same-named checkout elsewhere does
not establish which source is installed. Missing or conflicting evidence stops
dependent writes rather than selecting that checkout by convenience.

The installer owns `~/.local/bin/ayi`, the XDG configuration link and generated
command links. Public definitions use `tasks/`, `verification/`, `requirements/`
and `interface/`, with adjacent script locks where required. Use the current
installer contract for changes. Do not assume the retired `ai ask` interface,
copy Ayi back into Dotfiles, or infer activation from source tests. Authentication,
model selection and current shell state require their own evidence.

## Historical layouts

Only if actual launchers and metadata establish `amichne/shell-config`, inspect
its `config`/`dotfiles` wrappers, public `.dotfiles` worktree, `runtime/`,
`links.json` and installer as that layout's owners. Earlier `~/.cfg` bare-HOME
notes are also conditional history. Neither old nor new layout is an automatic
fallback. Never recreate one merely because this reference mentions it.

## Privacy and proof

History, credentials, private AI settings, machine overrides, recovery copies
and unrelated HOME files are not plugin source. Inspect the runner's input roots
before running it. Build disposable fixtures from declared public inventory or
tracked files, never a recursive copy of live HOME or dereferenced unrelated
links. Preserve selected modes, public paths and any real index. Use a test-owned
repository or temporary index for staging experiments. Report an unsafe aggregate
runner's exact limitation; do not delete private files or weaken assertions.

Report public source checks, isolated installer checks, installed native files or
link targets, fresh-shell behavior and current-session behavior separately.
A passing fixture proves its exercised contract only. This reference and its
regression tests do not establish model routing, better model outcomes or live
installation. Verify installed consumers only when installation is requested.
