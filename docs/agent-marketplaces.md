# Harnesses and marketplaces

Slopsentral adapts one authored graph for Codex, GitHub Copilot, and Pi.
The harnesses receive different package shapes and runtime behavior.
The adapters preserve shared source ownership without a claim of feature parity.

## Delivery paths

| Harness | Delivery | Entry point | User guide |
| --- | --- | --- | --- |
| Codex | `slopsentral` marketplace on `harness/codex` | `.agents/plugins/marketplace.json` | [Codex profile lifecycle](profile-lifecycle.md) |
| GitHub Copilot | `slopsentral` marketplace on `harness/github-copilot` | `.github/plugin/marketplace.json` | [Projection and provider output](pkl-projection.md) |
| Pi | `slopsentral-pi` archive in GitHub Releases | `.pi/slopsentral/package.json` in local projections | [Pi usage](pi-harness.md) |

Generated Codex and GitHub Copilot trees also appear on `main`.
Pi users install a release archive through Pi's package manager.
That installation needs no repository clone or local npm build.
The [README](../README.md#use-slopsentral-in-pi) supplies a released install command.

## Shared source and adaptations

The [marketplace source](../source/adaptable.marketplace.json) selects plugins.
Each [plugin manifest](../source/plugins/) references canonical skills, instructions, agents, hooks, and resources.
The graph resolver finds their dependencies before projection.
Plugins do not own copied primitive definitions.

The [projector](../tools/project-marketplaces.mjs) freezes the input and examines the graph before Pkl selects each target shape.
[Project.pkl](../tools/projection/Project.pkl) owns common copies and provider manifests.
[Pi.pkl](../tools/projection/Pi.pkl) owns the Pi package, profile manifest, skill list, and supported hook actions.
The projector copies scripts, locks, and resource sidecars with their canonical owners.
Generated trees and installed caches remain consumers.

| Resource | Codex adaptation | GitHub Copilot adaptation | Pi adaptation |
| --- | --- | --- | --- |
| Plugins | A `.codex-plugin/plugin.json` manifest per plugin | A `plugin.json` manifest per plugin | One package and extension with payloads per plugin |
| Skills | Plugin skill paths | Plugin skill paths | One manifest entry per canonical skill identity |
| Instructions | A generated `AGENTS.md` index and selected context hooks | A generated `AGENTS.md` index and selected context hooks | Selected instructions in a structured prompt section |
| Agents | Source Markdown and generated TOML declarations | Generated `.agent.md` files without the source `model` field | Reference paths in the profile prompt, without agent execution |
| Hooks | Hook JSON files with canonical events | One `hooks.json` per plugin with `bash` and `timeoutSec` fields | Native events with subprocess actions and translated results |
| MCP | Declared `.mcp.json` through the plugin manifest | No generated MCP connection | Bundled `.mcp.json` references without a connection |

These adaptations address different host contracts:

- **Instructions:** Pi reads selected instruction files into one structured prompt section.
  Its projector omits recognized instruction-injection commands to prevent duplicate text.
  Other startup actions run before the first prompt.
- **Hooks:** Copilot receives its command field names and a flat hook manifest.
  Pi maps prompt, tool, and completion events through its [runtime adapter](../source/hooks/pi/slopsentral.ts).
  The adapter uses argument arrays without shell evaluation and preserves original tool evidence.
  [Pi event mappings](pi-harness.md#event-adapters) describe each translation and cancellation limit.
- **Profiles:** Pi turns source `WORKFLOW_PROFILE` declarations into commands and a startup flag.
  It saves the selected workflow profile on the active session branch.
  `focusSkills` limits advertised package skills without a change to other packages.
  The source profile supplies `OFF`, `ADVISORY`, or `ENFORCING` hook policy.
- **Agents and tools:** Pi exposes agent and MCP references without automatic agents or server connections.
  Profile selection keeps the current model and tool set.
  A source declaration alone grants no server lifecycle or publication authority.
- **Provenance:** Codex and Pi include a `marketplace-lock.json` with source identities and payload digests.
  Pi releases promote one tested archive with candidate and promotion records.
  The [release procedure](pi-harness.md#automatic-releases) explains source identity and archive reuse.

The [projection procedure](pkl-projection.md) covers maintainer commands and fresh output paths.
The [architecture](../source/ARCHITECTURE.md) defines canonical ownership.
Projection proves package shape and source consistency.
Native host tests supply separate evidence for runtime behavior.
Neither proves that a model obeys instructions or selects the intended skill.

## Upstream Worktrunk marketplace

Slopsentral consumes Worktrunk for CLI worktree automation.
Its plugin payload stays with the [upstream marketplace](https://github.com/max-sixty/worktrunk).
Codex selects `worktrunk@worktrunk` through that marketplace's `.agents/plugins/marketplace.json`.

The source review used commit `dea4029c593a89a39fb141da9d0849e4d10dae19` on 2026-10-06.
This provenance does not claim that each consumer installed that revision.
The source tracks upstream unless the consumer pins its marketplace ref.

For requested installation, examine the configured source first:

```sh
codex plugin marketplace list --json
codex plugin marketplace add max-sixty/worktrunk
codex plugin add worktrunk@worktrunk --json
codex plugin list --json
```

Add the marketplace only when absent.
Preserve an existing matching source.
Install `wt` separately if needed.
A new host session must load the selected plugin before its skill or hooks can run.
Installation evidence does not prove native hook consumption.

Use [Worktrunk automation](worktrunk-automation.md) for project hooks, tests, and managed checkout ownership.
Worktrunk parses `.config/wt.toml`.
`wt hook show --expanded` examines and previews its configured hooks.
Integration tests exercise success and failure with the installed CLI in disposable repositories.
User hook trust and configuration stay with the user and host.
