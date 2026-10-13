# Slopsentral Glossary

This glossary covers plugins, agent skills, and the local writing tools that Slopsentral distributes.
The entries use established domain names and describe this checkout at `4fac2f71a27287658eb866375abb75ddc3b77bc6` plus the local Vale setup.
The initial entries are provisional.
No alternate label passed the synonym review, so each entry records `Known synonyms: none`.
That statement describes this review and does not claim that alternate labels never exist.

## Terms

- §AGENT PROFILE§: A named configuration that selects tools and settings for an agent's workflow.
  - Known synonyms: none
  - Domain usage: [Zed agent profiles](https://zed.dev/docs/ai/agent-profiles), examined 2026-10-13.
  - Local evidence: [Selection responsibilities](../source/ARCHITECTURE.md#primitive-responsibilities) and [workflow schema](../source/schemas/profiles/workflow-profile.schema.json).
  - Local scope: Slopsentral's workflow declaration selects packages, standalone procedure states, and policies. The lifecycle produces a named Codex configuration.
  - Example: The named configuration `local-development-default` selects resources for local engineering work.
  - Distinction: A §PLUGIN§ supplies capabilities. This configuration selects resources. A writer's style profile describes personal prose choices.
  - Synonym evidence: none

- §HOOK§: A configured action that an agent application starts when a named lifecycle event and its filter match.
  - Known synonyms: none
  - Domain usage: [Claude Code hooks](https://code.claude.com/docs/en/hooks#hook-lifecycle), examined 2026-10-13.
  - Local evidence: [Hook responsibilities](../source/ARCHITECTURE.md#primitive-responsibilities) and [hook source instructions](../source/hooks/AGENTS.md).
  - Local scope: Slopsentral declares event handlers. A declaration does not prove that an installed host delivers the event.
  - Example: The `required-skill-read` handler inspects a configured event.
  - Distinction: An event identifies an occurrence. The handler contains the action in response.
  - Synonym evidence: none

- §MARKETPLACE§: A catalog of installable packages and the locations that supply them.
  - Known synonyms: none
  - Domain usage: [Claude Code marketplaces](https://code.claude.com/docs/en/plugin-marketplaces), examined 2026-10-13.
  - Local evidence: [Marketplace source](../source/adaptable.marketplace.json) and [marketplace ownership](../AGENTS.md#marketplace-ownership).
  - Local scope: `source/adaptable.marketplace.json` declares Slopsentral's catalog for provider-specific output.
  - Example: The authored catalog lists the `technical-writing` package.
  - Distinction: A §PLUGIN§ is one installable package. A §MARKETPLACE§ lists packages and their sources.
  - Synonym evidence: none

- §PLUGIN§: A package that adds capabilities to an agent application.
  - Known synonyms: none
  - Domain usage: [Claude Code plugins](https://code.claude.com/docs/en/plugins), examined 2026-10-13.
  - Local evidence: [Composition responsibilities](../source/ARCHITECTURE.md#primitive-responsibilities) and [technical-writing package](../source/plugins/technical-writing/plugin.json).
  - Local scope: Slopsentral composes authored resources by reference. The package does not own another copy of those resources.
  - Example: `technical-writing` groups procedures for technical prose and documentation.
  - Distinction: A §SKILL§ supplies task instructions. A §PLUGIN§ combines resources for installation.
  - Synonym evidence: none

- §PLUGIN MANIFEST§: A file that declares a package's metadata and components.
  - Known synonyms: none
  - Domain usage: [Claude Code manifest reference](https://code.claude.com/docs/en/plugins-reference#manifest-file), examined 2026-10-13.
  - Local evidence: [Composition authority](../source/ARCHITECTURE.md#composition-and-evidence) and [technical-writing declaration](../source/plugins/technical-writing/plugin.json).
  - Local scope: `source/plugins/*/plugin.json` declares the package identity and references to authored resources.
  - Example: The `skills` array names procedure directories for the provider projector.
  - Distinction: A catalog lists several packages. This declaration describes one package and does not establish successful installation.
  - Synonym evidence: none

- §SKILL§: A directory with instructions in `SKILL.md` and optional resources that an agent reads for a specific task.
  - Known synonyms: none
  - Domain usage: [Agent Skills specification](https://agentskills.io/specification#directory-structure) and [Zed agent skills](https://zed.dev/docs/ai/skills), examined 2026-10-13.
  - Local evidence: [Source format](../source/skills/AGENTS.md#public-skill-standard) and `source/skills/controlled-technical-writing/SKILL.md`.
  - Local scope: Slopsentral keeps these directories under `source/skills/`. Each procedure must remain useful without its installation package.
  - Example: `controlled-technical-writing` supplies writing rules, glossary guidance, and local Vale resources.
  - Distinction: Instructions guide an agent. An event handler acts when its configured event occurs.
  - Synonym evidence: none

- §STYLE RULE§: A linter configuration that defines a prose condition and the finding to report.
  - Known synonyms: none
  - Domain usage: [Vale rule construction](https://github.com/vale-cli/vale/blob/v3.24.0/internal/check/substitution.go), examined 2026-10-13.
  - Local evidence: [Diction rule](../source/skills/controlled-technical-writing/assets/vale/styles/Slopsentral/Diction.yml) and [local configuration](../source/skills/controlled-technical-writing/assets/vale/.vale.ini).
  - Local scope: Bundled YAML files supply lexical and structural conditions for Vale 3.24.0.
  - Example: `Slopsentral.Diction` flags `utilize` and suggests `use`.
  - Distinction: A lexical finding identifies a configured form. It does not prove that two domain concepts have the same meaning.
  - Synonym evidence: none

- §VOCABULARY§: A collection of accepted or rejected word forms that a prose linter uses.
  - Known synonyms: none
  - Domain usage: [Vale vocabulary fixtures](https://github.com/vale-cli/vale/tree/v3.24.0/testdata/fixtures/vocab), examined 2026-10-13.
  - Local evidence: [Accepted product spellings](../source/skills/controlled-technical-writing/assets/vale/styles/config/vocabularies/Slopsentral/accept.txt).
  - Local scope: Vale's `accept.txt` and `reject.txt` control lexical findings in the selected configuration.
  - Example: The bundled accepted forms include `Slopsentral` and `Diataxis`.
  - Distinction: Accepted spelling does not establish a definition, a synonym, or current domain usage.
  - Synonym evidence: none
