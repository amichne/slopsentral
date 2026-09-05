# Workstream Catalog Migration

This is a breaking source-catalog reorganization. Plugin manifests use 1.0.0 to
make the changed composition explicit. This is not a claim that a repository
release or provider marketplace has already been published.

## Names and Ownership

| Previous surface | Current surface |
| --- | --- |
| git-ci-operations plugin | developer-tools plugin; local Git, CLI, shell, and mise |
| define-goal in local Git | engineering-baseline |
| reference-doc-workflow and site-docs-authoring in code knowledge | writing |
| local-repository-navigation in agent authoring | code-knowledge-base |
| type-safety in every plugin | engineering-baseline only |
| schema-driven-design in every plugin | api-contracts only |
| required-skill-read in baseline | agent-platform-authoring; empty opt-in requirements |
| gh-fix-ci | github-ci-operations |
| doc-coauthoring | technical-documentation; controlled-technical-writing for prose-only edits |
| skill-creator | skill-primitive-authoring |
| jira-resolve-ticket | issue-tracker-operations |

Empty gh-cli, ink, review-duplication, and tdd-red-green-refactor migration
placeholders are removed. Independent frontend, Cloudflare, Stripe, Vercel, and
other existing standalone specialties remain outside default plugin profiles.

## Profiles

kotlin-repo-default and intellij-plugin-default select developer-tools under its
new name and no longer install generic required-skill-read advice. New profiles
cover local development, documentation, and agent authoring without pulling in
unrelated hosted delivery or language-specific tooling.

Profiles describe composition; do not assume the host installs them atomically.
Use the generated catalog to inspect the selected plugins. Standalone skill
installation remains supported through source/tools/install-skill.

## Evaluation Interpretation

Existing routing case and golden fixture labels are migrated to the current
plugin name. Their historical source records are not evidence of a fresh model
run. Benchmark definitions now select gpt-6-astra; this changes the next run's
configuration, not the status of any previous observation. New scenarios in
`evals/astra-workstreams.md` require live execution before route-quality claims.

The required projeKtor v1.1.0 pins and both harness validation jobs are retained.
A passing source graph, replay fixture, or projection cannot establish measured
Astra token savings or live behavior. Report those only after an authorized run.
