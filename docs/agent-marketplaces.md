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
The [README](releases.md) links the latest release and its pinned install command.

## Shared source and adaptations

The [marketplace source](../source/adaptable.marketplace.json) selects plugins.
Each [plugin manifest](../source/plugins/) references canonical skills, instructions, agents, hooks, and resources.
The graph resolver finds their dependencies before projection.
Plugins do not own copied primitive definitions.

The [file adapter](../tools/marketplace.py) freezes input bytes before Pkl resolves the graph and selects each target shape.
[Source.pkl](../tools/projection/Source.pkl) owns canonical references, dependency closure, and profile selection.
[Project.pkl](../tools/projection/Project.pkl) owns common copies and provider manifests.
[Pi.pkl](../tools/projection/Pi.pkl) owns the Pi package, profile manifest, skill list, and supported hook actions.
The projector copies scripts, locks, and resource sidecars with their canonical owners.
Generated trees and installed caches remain consumers.

| Resource | Codex adaptation | GitHub Copilot adaptation | Pi adaptation |
| --- | --- | --- | --- |
| Plugins | A `.codex-plugin/plugin.json` manifest per plugin | A `plugin.json` manifest per plugin | One package and extension with payloads per plugin |
| Skills | Plugin skill paths | Plugin skill paths | Managed bindings and canonical content, without native skill exports |
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
  [Pi hook policies](pi-harness.md#hook-policies) describe execution, output, and cancellation limits.
- **Profiles:** Pi turns source `WORKFLOW_PROFILE` declarations into commands and a startup flag.
  It saves the selected workflow profile on the active session branch.
  `focusSkills` selects package skills, and `skills` supplies explicit selections and invocation policies.
  One resolved plan governs managed discovery, command and tool admission, hooks, and inspection.
  Unrelated packages keep their native skill routes.
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
