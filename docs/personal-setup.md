# Change personal configuration

Use Personal Setup Management for an explicit personal-configuration task.
The public source owns reusable configuration. Private settings, credentials, history, and machine overrides stay outside its tracked tree.

## Establish the installed owner

Read the resolved `config` and `dotfiles` launchers before a source change.
Examine their Git directory, worktree, origin, status, layout manifest, and installer.
If those facts conflict, stop dependent writes.
A retained checkout or historical dotfiles layout cannot establish the installed owner.

Keep existing overrides and unrelated edits.
Use the established launcher, runtime, completion, and installation owners.
Stage explicit public paths only. A setup request alone grants no push authority.

## Prove the public change

Examine the runner's input roots before a test command against a HOME worktree.
Create a disposable fixture from its declared public inventory or tracked files.
Do not recursively copy live HOME.
Private configuration, history, credentials, and unrelated links stay outside the fixture.

A fixture result establishes public-source behavior.
When installation forms part of the task, separately examine the installed link and a fresh shell.
Report source and installed results separately.

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
