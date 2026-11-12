# Choose a marketplace

Use the host marketplace for plugin selection. Keep authored source, published provider output, and installed caches separate.
The [catalog](../source/CATALOG.md) lists the current plugins and their canonical assets.
The [source-ownership concept](../openwiki/concepts/source-ownership.md) explains that relationship.

## Sources and entry points

| Consumer | Source | Entry point |
| --- | --- | --- |
| Codex | `amichne/slopsentral`, `harness/codex` | `.agents/plugins/marketplace.json` |
| GitHub Copilot | `amichne/slopsentral` | `.github/plugin/marketplace.json` |
| Amp | Stable release archive or `harness/amp` | Complete `.amp/plugins/<plugin>/` directories |
| Pi | Qualified stable release | Native aggregate package |
| dotagents | `amichne/slopsentral`, `harness/dotagents` | Agent Plugins v1 bundles |
| Codex with Worktrunk | `max-sixty/worktrunk` | Upstream `.agents/plugins/marketplace.json` |

The [Slopsentral command](cli-install.md) preserves recognized Codex and Copilot sources.
An unknown source named `slopsentral` stops an operation.
Provider branches advance. A recorded commit identifies the exact provider bytes.
Stable release archives keep their published versions.

## Select capabilities

Start with Software Engineering. Add Kotlin Engineering for Kotlin work.
Add another specialty for a concrete task.
A plugin supplies procedures and resources. Selection grants no authority to publish or change personal configuration.

For the supported host installer, use explicit selections:

```sh
slopsentral install --host codex --plugin software-engineering --plugin kotlin-engineering
slopsentral install --host copilot --plugin software-engineering
```

These commands change the selected host configuration. They need an authorized installation task.
Use the [command guide](cli-install.md) for prerequisites, updates, and removal.

## Install through dotagents

In the consuming project, set `agents` in `agents.toml` to the hosts you use.
For a project that uses all seven plugin targets, use this configuration:

```toml
version = 1
agents = ["claude", "cursor", "codex", "copilot", "grok", "opencode", "pi"]
```

Add the full Slopsentral catalog from its dotagents branch:

```sh
npx @sentry/dotagents@3.4.0 --project add amichne/slopsentral --ref harness/dotagents --all
npx @sentry/dotagents@3.4.0 --project list
```

Use `install` to refresh the declared plugins.
Run `add --all` with the same source and ref to include new catalog entries.
For a fixed catalog revision, use its commit SHA as the ref.
Use the host's marketplace controls when the host needs plugin registration or activation.
The [dotagents guide](https://dotagents.sentry.dev/) describes its host outputs.
The [projection guide](pkl-projection.md#dotagents-plugin-bundles) describes the Slopsentral capabilities in those outputs.

## Qualify an APM installation

The [APM guide](apm-qualification.md) records complete-bundle transport through APM 0.35.0 and Codex 0.163.0 on macOS arm64.
Its isolated checks cover installed contents, direct context execution, admission refusals, and ownership-safe cleanup.
Automatic hook delivery and model behavior remain untested.
The loose Copilot conversion fails the executable control.

## Add Worktrunk when requested

Examine the configured marketplace before an installation:

```sh
codex plugin marketplace list --json
```

If the upstream marketplace is absent, add it:

```sh
codex plugin marketplace add max-sixty/worktrunk
codex plugin add worktrunk@worktrunk --json
codex plugin list --json
```

Keep a matching existing source. Install the `wt` executable separately.
Use [Worktrunk automation](worktrunk-automation.md) for project commands and their limits.
A new host session must discover the plugin. Inventory alone proves neither hook delivery nor model behavior.

## Source evidence

[Host selection](../tools/slopsentral.py) owns marketplace reconciliation.
[Publication](../.github/workflows/publish-harnesses.yml) owns provider branches.
The [host-command tests](../tools/python_checks/test_slopsentral.py) cover recognized sources, conflicts, and disabled choices.
The historical Worktrunk review used `dea4029c593a89a39fb141da9d0849e4d10dae19` on 2026-10-06.
That record does not identify a current installation.
