---
name: personal-setup-management
description: "Review or change personal shell configuration, dotfiles, command installation, and completion registration. Verify the source for a source-only patch; discover the actual installed owner before changing HOME or activation. Private settings remain outside the public inventory."
---

# Personal Setup Management

Use this for explicit personal setup work. Establish whether the task concerns
source, installation, or the running consumer before selecting a workflow.
Private settings, history, credentials and
machine overrides belong outside the public inventory.

## Workflow

1. Establish the requested surface. For source-only design, review, or a patch,
   verify the source repository or supplied snapshot, revision, public inventory,
   and scoped changes. Record unavailable installed state without choosing a
   live destination. A source result can be complete without installation.
   When the task depends on an installed command or HOME file, resolve the
   actual command or shell entrypoint and
   inspect its launcher, link target, implementation, repository instructions,
   public inventory and installer. Do not assume a launcher name or source root.
   Verify Git directory, worktree, `core.bare`, origin, revision, branch and scoped
   status with explicit Git arguments. For an archive registry, inspect the
   installer's source marker and local Git identity instead of inventing an
   origin. Stop dependent writes if the required identity is ambiguous or conflicts.
2. Read [layout and ownership](references/shell-config-layout.md) when locating
   source or changing installation. The recorded layout is a discovery aid;
   confirm it on the current machine. A retained checkout is not evidence of
   the installed source. Inspect only paths needed for the requested change.
3. Reuse the verified owner for the selected surface. Current `amichne/dotfiles` owns native HOME paths,
   `df`, `.dotfiles.git` and `scripts/install.py`; current `amichne/ayi` owns its
   command registry and installer. A HOME file can be the tracked runtime file,
   while an Ayi command can be a consumer link. Historical `shell-config`,
   `config`/`dotfiles`, `runtime` and `links.json` apply only if rediscovered and
   verified. Preserve local overrides, consumers, staged and unrelated edits.
4. For a personal command, use `cli-creator` for the command contract,
   parameter precedence, composition, completion and source-backed `--teach`.
   Use Python Tooling for automation. Keep only the required parent-shell adapter
   when session state cannot be accessed from a child process. These are separate procedures, not automatic extra work.
5. Make the requested source change in the verified owner. Register public paths
   with its actual inventory and installer; do not add a link manifest to a
   native HOME layout. Never bulk-stage HOME or the source tree. Stage
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

Report the verified source identity, Git directory and worktree when present,
changed public paths, and focused check. For installed work, also report the
verified installed identity and activation state. Separate checkout,
installed files or links, fresh shell and current session evidence.
Unavailable or conflicting authority
is a named gap; it never becomes permission to guess a destination.
