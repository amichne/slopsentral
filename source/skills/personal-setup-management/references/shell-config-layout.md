# Shell-config authority and ownership

This is a public-safe snapshot verified on 2026-10-06. Reopen the actual
launchers and manifests before acting; local layout can change.

The current `config` wrapper delegates to:

```sh
git -C "$HOME/.dotfiles" --git-dir="$HOME/.dotfiles.git" \
  --work-tree="$HOME/.dotfiles" "$@"
```

Origin is `amichne/shell-config`. Git metadata is separate from the public
worktree, but `core.bare` is currently `false`. The older bare `~/.cfg` repository
with HOME as its worktree is historical. Do not recreate it or use it as a
fallback merely because an old instruction says "bare dotfiles."

Use read-only discovery first:

```sh
command -v config
# Read this launcher's resolved source before trusting its arguments.
config rev-parse --absolute-git-dir
config config --get core.worktree
config config --get core.bare
config remote get-url origin
config status --short --branch
config ls-files -- .local/bin runtime .config/zsh links.json install.py
```

Equivalent SSH and HTTPS origin URLs are valid only after comparing the exact
host, owner and repository. Do not accept substring matches or guess an origin.

The observed ownership boundaries are:

| Path in the public tree | Responsibility |
| --- | --- |
| `.local/bin/config`, `.local/bin/dotfiles` | Git wrapper and installer launcher |
| `.local/bin/<tool>` | Thin executable entrypoint |
| `runtime/<area>/` | Reusable implementation and pure decisions |
| `runtime/tests/` | Owning executable checks |
| `.config/zsh/functions/` | Autoloaded shell functions |
| `.config/zsh/completions/` | Local completion functions available before compinit |
| `links.json`, `install.py` | Public source to consumer link mapping and installation |
| `runtime/.zshrc.local.example` | Public example for private machine overrides |

The installed `~/.local/bin` files and shell files are consumer links. Follow
the link and inspect the manifest rather than editing an assumed copy. Verify
the installer contract before adding a link; do not introduce a second owner.

History, authentication, `.zshrc.local`, private AI settings, rollback state and
unrelated HOME files are not source material for this plugin. Use tracked
inventory and named paths; never recursively inspect HOME to "learn the setup."

The current `ai ask` surface accepts a prompt on stdin and delegates to a
configured assistant. Reuse that boundary for teaching when selected. Confirm
its current help and source contract; this plugin does not own model selection,
authentication or assistant permissions.

When proving a setup change, distinguish public source tests, an isolated
installer test, installed link verification and a live shell smoke test. One
does not establish the others. Preserve the real index when testing selective
staging; use a test-owned repository or temporary index for experiments.
