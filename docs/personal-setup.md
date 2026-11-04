# Change personal configuration

Use Personal Setup Management for an explicit personal-configuration task.
The public source owns reusable configuration. Private settings, credentials, history, and machine overrides stay outside its tracked tree.

## Establish the installed owner

Resolve the affected command or shell entrypoint before a source change.
Read its launcher, necessary implementation, link target, public inventory and installer.
Examine the source revision, Git directory, worktree, `core.bare`, origin and scoped status.
Inspect bare metadata before supplying `--work-tree`, which changes Git's bare-state observation.
If those facts conflict, stop dependent writes.
A retained checkout or historical dotfiles layout cannot establish the installed owner.

Keep existing overrides and unrelated edits.
Current `amichne/dotfiles` owns native HOME files through `df`, `.dotfiles.git` and `scripts/install.py`.
Tracked HOME files are runtime files, rather than consumer links into another tree.
Current `amichne/ayi` owns the reusable AI command registry and its installer.
Resolve the installed Ayi links: an archive registry has a `.ayi-source` commit marker and can lack an origin.
Record its local registry revision separately from that upstream marker and any developer checkout.
Use historical `shell-config`, `config`/`dotfiles`, `runtime` or `links.json` only when actual discovery establishes that layout.
Use the verified inventory, completion and installation owners; do not introduce a second installer.
Stage explicit public paths only. A setup request alone grants no push authority.

## Prove the public change

Examine the runner's input roots before a test command against a HOME worktree.
Create a disposable fixture from its declared public inventory or tracked files.
Do not recursively copy live HOME.
Private configuration, history, credentials, and unrelated links stay outside the fixture.

A fixture result establishes public-source behavior.
When installation forms part of the task, separately examine installed native files or consumer links and a fresh shell.
A reviewed installer plan does not apply it. Source tests do not prove installation or current-session activation.
Report source, installer, installed-consumer and shell results separately.

## Create a personal command

Use CLI Creator for parameter precedence, JSON results, completion, and source-backed `--teach` behavior.
Use Python Tooling for new automation. Existing Kotlin projects keep their toolchains.
A parent-shell adapter can supply history that a child process cannot read.

The retained JavaScript sample illustrates the command contract:

```sh
node source/skills/cli-creator/assets/personal-size.mjs --help
node source/skills/cli-creator/assets/personal-size.mjs --min-bytes 1048576 --json
node source/skills/cli-creator/assets/personal-size.mjs --teach "Explain this tool" --teach-preview
```

The preview supplies source identities and selected context without a model request.
It grants no authority to change installed configuration or start an external adapter.

## Source evidence

[Personal Setup Management](../source/skills/personal-setup-management/SKILL.md) owns the procedure.
Its [layout reference](../source/skills/personal-setup-management/references/shell-config-layout.md) supplies discovery leads.
[CLI Creator](../source/skills/cli-creator/SKILL.md) owns command design.
Use the [migration map](../source/MIGRATION.md) before an update to a historical host installation.
