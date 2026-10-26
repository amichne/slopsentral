---
name: personal-setup-management
description: "Manage amichne/shell-config and personal dotfiles through the verified config wrapper, separate Git directory, public source tree, and installed consumer links. Use for personal setup changes, command installation, shell configuration, or completion registration; verify the current layout before using historical bare-HOME instructions."
---

# Personal Setup Management

Use this for the user's shell-config setup. The public repository owns reusable
configuration and tools; private settings, history, credentials and machine
overrides belong outside its tracked tree.

## Workflow

1. Establish authority. Read the resolved `config` and `dotfiles` launchers,
   repository instructions, layout manifest and installer. Verify Git directory,
   worktree, `core.bare`, origin, branch, status and relevant tracked paths with
   explicit Git arguments. Stop dependent writes if identity is ambiguous.
2. Read [layout and ownership](references/shell-config-layout.md) when locating
   source or changing installation. The recorded layout is a discovery aid;
   confirm it on the current machine. A retained checkout is not evidence of
   the installed source. Inspect only paths needed for the requested change.
3. Reuse the current owner: launchers in `.local/bin`, implementations under
   `runtime`, shell functions and completions under `.config/zsh`, and link
   installation through the existing manifest and installer. Preserve existing
   local overrides, consumers, staged changes and unrelated source edits.
4. For a personal command, use `cli-creator` for the command contract,
   parameter precedence, composition, completion and source-backed `--teach`.
   Use Python Tooling for automation. Keep only the required parent-shell adapter
   when session state cannot be accessed from a child process. These are separate procedures, not automatic extra work.
5. Make the requested source change. Register new installed paths with the
   actual installer owner. Never bulk-stage HOME or the source tree. Stage
   explicit public paths only when a commit is in scope. Do not push from a
   setup request alone.
6. Inspect the runner's input roots before running checks against a HOME worktree.
   Build an isolated fixture from the declared public file inventory or tracked
   source, never a recursive copy of live HOME. Exclude private configuration,
   histories, credentials, and unrelated links; preserve the public paths and
   modes the check needs. Run the narrow owning check there. If a required
   aggregate cannot run safely in this layout, report its exact setup failure;
   do not delete personal files or loosen assertions to make it green.
7. Verify the affected installed consumer only when installation was requested.
   Validate source, consumer link target, help, completion and a fresh shell as
   appropriate. Passing fixture checks do not prove the live shell loaded it.

## Completion

Report the verified Git directory and worktree, changed public paths, focused
check and installed-versus-source state. Unavailable or conflicting authority
is a named gap; it never becomes permission to guess a destination.
