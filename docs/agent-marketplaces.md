# Agent Marketplaces

Slopsentral authors reusable agent workflows and consumes Worktrunk for CLI
worktree automation. Plugin payloads remain with their owning marketplaces.

| Provider | Marketplace | Source | Entrypoint | Selected capability |
| --- | --- | --- | --- | --- |
| Codex | slopsentral | https://github.com/amichne/slopsentral/tree/harness/codex | `.agents/plugins/marketplace.json` | Software Engineering and Agent Tooling for marketplace work |
| GitHub Copilot | slopsentral | https://github.com/amichne/slopsentral/tree/harness/github-copilot | `.github/plugin/marketplace.json` | Same authored workflows through projeKtor |
| Codex | worktrunk | https://github.com/max-sixty/worktrunk | `.agents/plugins/marketplace.json` | `worktrunk@worktrunk` configuration guidance and upstream host hooks |

The Worktrunk source was reviewed at
`dea4029c593a89a39fb141da9d0849e4d10dae19` on 2026-10-06. This is review
provenance, not a claim that every consumer installed that revision. The source
tracks upstream unless the consumer pins its marketplace ref.

For requested installation, inspect the configured source first:

```sh
codex plugin marketplace list --json
codex plugin marketplace add max-sixty/worktrunk
codex plugin add worktrunk@worktrunk --json
codex plugin list --json
```

Add the marketplace only when absent; preserve an existing matching source.
Install `wt` separately if needed. A new host session must load the selected
plugin before its skill or hooks can run. Installation evidence does not prove
native hook consumption.

Follow [Worktrunk automation](worktrunk-automation.md) for project hooks,
verification, and managed checkout ownership. `.config/wt.toml` is parsed by
Worktrunk; `wt hook show --expanded` validates and previews its configured hooks.
The integration tests exercise success and failure with the actual installed
CLI in disposable repositories. User hook trust and configuration stay owned
by the user and host.
