# Canonical release assets

The [latest release](https://github.com/amichne/slopsentral/releases/latest) is the canonical installation set.
Each `slopsentral-v0.1.<run>` release contains all three supported projections from one source revision.
It supersedes earlier marketplace, component, and Pi-only releases.
Historical releases, tags, and asset URLs remain available.

| Asset | Consumer and purpose |
| --- | --- |
| `slopsentral-codex.tar.gz` | Codex marketplace snapshot under `.agents/plugins` |
| `slopsentral-github-copilot.tar.gz` | Copilot marketplace snapshot under `.github/plugin` |
| `slopsentral-pi-<version>.tgz` | Optional Pi extension, installed through Pi |
| `SHA256SUMS` | SHA-256 identities of all three archives |
| `release-assets.json` | Exact source revision, names, sizes, and provider archive digests |
| `candidate.json`, `promotion.json` | Pi producer, tested Git tree, main admission, and archive identity |

## Codex and Copilot

The [installation guide](public/guides/install.mdx) documents marketplace discovery and plugin selection.
The `harness/codex` and `harness/github-copilot` branches publish the same tested payloads as the release archives.
For an immutable local snapshot, download the archive and `SHA256SUMS` from one release into a new directory.
On macOS, compare `shasum -a 256 slopsentral-codex.tar.gz` with its line in `SHA256SUMS`.
Use the corresponding archive name for Copilot.
Extract the selected archive into an empty directory:

```bash
mkdir marketplace
tar -xzf slopsentral-codex.tar.gz -C marketplace
codex plugin marketplace add "$PWD/marketplace" --json
codex plugin add software-engineering@slopsentral --json
codex plugin list --json
```

For Copilot, extract `slopsentral-github-copilot.tar.gz` instead and register the extracted root directory:

```bash
copilot plugin marketplace add "$PWD/marketplace"
copilot plugin install software-engineering@slopsentral
copilot plugin list
```

Use one source per host and examine an existing registration before replacement.
A repeat installation must keep one plugin identity in the host inventory.
Start a fresh session after installation.
Hook trust remains an explicit host decision.

## Pi extension scope

The optional in-repository extension adapts declared capabilities to Pi 1.3.0.
No external Pi extension or workflow bundle is selected.

| Retained behavior | Codex or Copilot counterpart | Evidence and limit |
| --- | --- | --- |
| Managed skill discovery and loading | Plugin skill catalog and skill content | Native Pi loader and installed-archive tests examine the same authored skills. Invocation transport differs. |
| Selected instruction context | Generated plugin instructions and context hooks | Native host tests examine exact selected content. No model-obedience claim follows. |
| Declared hook actions and completion gates | Provider hook contracts | Projected contract and native Pi tests examine typed results, cancellation, and policies. Host event timing differs. |
| Profile inspection and selection | Declarative profile source and explicit host setup | One resolved Pi plan explains active bindings. This is adapter configuration, not an agent orchestration system. |

Agent files and MCP references do not start child agents or connect servers in Pi.
No live model integration or paid inference is part of release qualification.
The [Pi guide](pi-harness.md) documents exact commands, missing tools, update scopes, and removal.

## Publication contract

`Validate Source` compiles the legal examples and rejects the forbidden calls.
It runs source, Python, schema, catalog, documentation, all projections, and projected hook checks.
It keeps Codex and Copilot archives after those projected checks pass.
The Pi candidate job depends on source success and installs its archive before sealing it.

Only a successful main run permits publication.
Both publication workflows admit that run's exact revision and producer attempt before they consume its artifacts.
Provider archive digests and names must match their manifest before extraction.
The Pi candidate and promotion records admit the producer and exact Git tree.
The main run builds and installs its own Pi candidate so all three archives name the same source revision.
Publication consumes the tested bytes and does not project or package a second asset set.
Missing artifacts, failed validation, changed bytes, and mismatched revisions stop publication.

Publication first creates a draft release.
Actual GitHub downloads must match all archive checksums and provenance records before the release receives the Latest designation.
An existing lightweight tag is accepted only at the exact admitted revision.
A different existing tag stops publication.
