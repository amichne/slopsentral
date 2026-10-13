# Kotlin-focused consolidation

The uv foundation at `774716ce2cdee28133d463ae865f4c67bef68fb4` ships 11 plugins and 61 skills.
The new catalog ships five plugins and 28 skills.
The reductions equal 55% of plugins and 54% of marketplace skills after rounding.

## Plugin replacements

| Retired plugin | Replacement |
| --- | --- |
| `api-contracts`, `personal-configuration`, `pkl-workflows` | `developer-tooling` |
| `pkl-repository-checks`, `repository-source-checks`, `skill-read-policy` | Explicit standalone hooks for a custom repository composition |

Software Engineering, Kotlin Engineering, IntelliJ Plugin Development, Developer Tooling, and Repository Knowledge keep their identifiers.
Each changed bundle receives a major version increase.
Developer Tooling contains no hooks. The consolidation adds no automatic source, Pkl, API-context, or skill-read behavior.

## Skill replacements

| Retired skill | Owner |
| --- | --- |
| `agent-profile-authoring` | `skill-primitive-authoring` |
| `bounded-delegation` | `tdd` |
| `define-goal` | `tdd` |
| `delivery-pipeline-design` | `github-ci-operations` |
| `hook-primitive-authoring` | `plugin-composition-authoring` |
| `ide-diagnostics-mcp` | `intellij-platform-testing` |
| `intellij-platform-integrations` | `intellij-plugin-delivery` |
| `kotlin-agentic-correctness` | `kotlin-design-practices` |
| `kotlin-api-surface-design` | `kotlin-design-practices` |
| `kotlin-branching` | `kotlin-design-practices` |
| `kotlin-observability-design` | `kotlin-application-stack` |
| `okf` | `code-knowledge-base` |
| `okf-refactor` | `code-knowledge-base` |
| `openapi-contract-rating` | `openapi-contract-authoring` |
| `openapi-schema-modeling` | `openapi-contract-authoring` |
| `personal-cli-authoring` | `cli-creator` |
| `pkl-pattern-catalogs` | `pkl-engineering` |
| `pkl-specification` | `pkl-engineering` |
| `pkl-tooling-setup` | `pkl-engineering` |
| `primitive-routing-evaluation` | `skill-primitive-authoring` |
| `reference-doc-workflow` | `technical-documentation` |
| `repo-instruction-topology` | `plugin-composition-authoring` |
| `repository-onboarding` | `git-change-flow` |
| `repository-signature-indexing` | `code-knowledge-base` |
| `site-docs-authoring` | `technical-documentation` |
| `terminal-ui-design` | `cli-creator` |
| `validation-first` | `tdd` |

Merged skills keep their distinct contracts as task-routed references, scripts, fixtures, or focused procedures.
Compiler proof, negative cases, OpenAPI examples, CLI contracts, diagnostics, and OKF helpers remain under their new owners.

## Removed distribution

The catalog removes `agents-sdk`, `frontend-design`, `grill-me-with-docs`, `migrate-to-codex`, `react-best-practices`, `refactor`, `stripe-best-practices`, and `workflow`.
These surfaces duplicate general procedures or target work outside the Kotlin-first scope.
Git history preserves their source and provenance.

The previous uv foundation already retired shell authoring and shell data-pipeline skills.
Automation remains Python with uv, PEP 723, locks, strict Pyright, Ruff, and pytest.
The parent-shell adapter stays only for history that its child process cannot read.

## Consumer changes

Profiles now select the surviving bundles.
The `pkl-checked-repository` profile keeps its identifier for callers but selects guidance only.
Custom automatic Pkl checks need an explicit hook composition.
The default Kotlin selection remains `software-engineering` plus `kotlin-engineering`.

After authorized publication, install the replacement bundles through the host.
Disable retired bundles before a fresh session.
Reapply selected profiles and examine hook trust.
Older installed caches and unrelated configuration layers do not change through this source edit.

Golden fixtures name the new routes. They do not prove model behavior.
Historical records keep their original identities and evidence.
Two historical routes receive `NEEDS_REPLAY_CASE` status because their replacement skills lack a fresh replay.

## Reversal

Use the recorded foundation revision to recover the previous catalog.
Keep source manifests, skill paths, profiles, and generated projections on the same revision.
Do not combine old installed bundles with their replacements.
