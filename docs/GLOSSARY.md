# Slopsentral Glossary

Generated from `glossary.json`. Edit the JSON source.

Slopsentral plugins, agent skills, and local prose tools.
Source review supports these entries. Independent reader review remains absent.

## Terms

### agent profile

A named configuration that selects tools and settings for an agent's workflow.

Scope: Slopsentral's workflow declaration selects packages, standalone procedure states, and policies. The lifecycle produces a named Codex configuration.
Example: The named configuration `local-development-default` selects resources for local engineering work.
Distinction: A plugin supplies capabilities. This configuration selects resources. A writer's style profile describes personal prose choices.
Justification: The cited domain source uses this established name for this concept.

Domain usage:

- [Zed agent profiles](https://zed.dev/docs/ai/agent-profiles), examined 2026-10-13. A named configuration that selects tools and settings for an agent's workflow.

Local evidence:

- `source/ARCHITECTURE.md`: Selection responsibilities.
- `source/schemas/profiles/workflow-profile.schema.json`: workflow schema.

Rejected forms:

No replacement or review target passed the evidence review.

### hook

A configured action that an agent application starts when a named lifecycle event and its filter match.

Scope: Slopsentral declares event handlers. A declaration does not prove that an installed host delivers the event.
Example: The `required-skill-read` handler inspects a configured event.
Distinction: An event identifies an occurrence. The handler contains the action in response.
Justification: The cited domain source uses this established name for this concept.

Domain usage:

- [Claude Code hooks](https://code.claude.com/docs/en/hooks#hook-lifecycle), examined 2026-10-13. A configured action that an agent application starts when a named lifecycle event and its filter match.

Local evidence:

- `source/ARCHITECTURE.md`: Hook responsibilities.
- `source/hooks/AGENTS.md`: hook source instructions.

Rejected forms:

No replacement or review target passed the evidence review.

### marketplace

A catalog of installable packages and the locations that supply them.

Scope: `source/adaptable.marketplace.json` declares Slopsentral's catalog for provider-specific output.
Example: The authored catalog lists the `repository-knowledge` plugin.
Distinction: A plugin is one installable package. A marketplace lists packages and their sources.
Justification: The cited domain source uses this established name for this concept.

Domain usage:

- [Claude Code marketplaces](https://code.claude.com/docs/en/plugin-marketplaces), examined 2026-10-13. A catalog of installable packages and the locations that supply them.

Local evidence:

- `source/adaptable.marketplace.json`: Marketplace source.
- `AGENTS.md`: marketplace ownership.

Rejected forms:

No replacement or review target passed the evidence review.

### plugin

A package that adds capabilities to an agent application.

Scope: Slopsentral composes authored resources by reference. The package does not own another copy of those resources.
Example: The `repository-knowledge` plugin groups skills for technical prose and repository knowledge.
Distinction: A skill supplies task instructions. A plugin combines resources for installation.
Justification: The cited domain source uses this established name for this concept.

Domain usage:

- [Claude Code plugins](https://code.claude.com/docs/en/plugins), examined 2026-10-13. A package that adds capabilities to an agent application.

Local evidence:

- `source/ARCHITECTURE.md`: Composition responsibilities.
- `source/plugins/repository-knowledge/plugin.json`: technical-writing package.

Rejected forms:

No replacement or review target passed the evidence review.

### plugin manifest

A file that declares a package's metadata and components.

Scope: `source/plugins/*/plugin.json` declares the package identity and references to authored resources.
Example: The `skills` array names procedure directories for the provider projector.
Distinction: A catalog lists several packages. This declaration describes one package and does not establish successful installation.
Justification: The cited domain source uses this established name for this concept.

Domain usage:

- [Claude Code manifest reference](https://code.claude.com/docs/en/plugins-reference#manifest-file), examined 2026-10-13. A file that declares a package's metadata and components.

Local evidence:

- `source/ARCHITECTURE.md`: Composition authority.
- `source/plugins/repository-knowledge/plugin.json`: technical-writing declaration.

Rejected forms:

No replacement or review target passed the evidence review.

### skill

A directory with instructions in `SKILL.md` and optional resources that an agent reads for a specific task.

Scope: Slopsentral keeps these directories under `source/skills/`. Each procedure must remain useful without its installation package.
Example: `controlled-repository-knowledge` supplies writing rules, glossary guidance, and local Vale resources.
Distinction: Instructions guide an agent. An event handler acts when its configured event occurs.
Justification: The cited domain source uses this established name for this concept.

Domain usage:

- [Agent Skills specification](https://agentskills.io/specification#directory-structure), examined 2026-10-13. A directory with instructions in `SKILL.md` and optional resources that an agent reads for a specific task.
- [Zed agent skills](https://zed.dev/docs/ai/skills), examined 2026-10-13. A directory with instructions in `SKILL.md` and optional resources that an agent reads for a specific task.

Local evidence:

- `source/skills/AGENTS.md`: Source format.
- `source/skills/controlled-technical-writing/SKILL.md`: Skill entry point.

Rejected forms:

No replacement or review target passed the evidence review.

### style rule

A linter configuration that defines a prose condition and the finding to report.

Scope: Bundled YAML files supply lexical and structural conditions for Vale 3.24.0.
Example: `Slopsentral.Diction` flags `utilize` and suggests `use`.
Distinction: A lexical finding identifies a configured form. It does not prove that two domain concepts have the same meaning.
Justification: The cited domain source uses this established name for this concept.

Domain usage:

- [Vale rule construction](https://github.com/vale-cli/vale/blob/v3.24.0/internal/check/substitution.go), examined 2026-10-13. A linter configuration that defines a prose condition and the finding to report.

Local evidence:

- `source/skills/controlled-technical-writing/assets/vale/styles/Slopsentral/Diction.yml`: Diction rule.
- `source/skills/controlled-technical-writing/assets/vale/.vale.ini`: local configuration.

Rejected forms:

No replacement or review target passed the evidence review.

### vocabulary

A collection of accepted or rejected word forms that a prose linter uses.

Scope: Vale's `accept.txt` and `reject.txt` control lexical findings in the selected configuration.
Example: The bundled accepted forms include `Slopsentral` and `Diataxis`.
Distinction: Accepted spelling does not establish a definition, a synonym, or current domain usage.
Justification: The cited domain source uses this established name for this concept.

Domain usage:

- [Vale vocabulary fixtures](https://github.com/vale-cli/vale/tree/v3.24.0/testdata/fixtures/vocab), examined 2026-10-13. A collection of accepted or rejected word forms that a prose linter uses.

Local evidence:

- `source/skills/controlled-technical-writing/assets/vale/styles/config/vocabularies/Slopsentral/accept.txt`: Accepted product spellings.

Rejected forms:

No replacement or review target passed the evidence review.
