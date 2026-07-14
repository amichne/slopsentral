---
name: "code-knowledge-base"
description: "Create, refresh, and impact-check OKF knowledge bundles for Kotlin/Gradle codebases with source-backed Markdown concept documents. Use when docs should be generated from concrete repository facts, linked to code evidence, and kept current without a provider-specific data store."
---

# Code Knowledge Base

Use this skill to maintain an Open Knowledge Format bundle for a Kotlin/Gradle
repository. The bundle is portable Markdown with YAML frontmatter; source
evidence lives in frontmatter extensions, Markdown links, and citations rather
than a provider-specific cache or database.

## Operating Contract

- Keep authoring provider and harness agnostic; runtime hooks are adapters.
- Treat code, schemas, generated contracts, checked docs, and tests as evidence.
- Use semantic indexes, compiler tools, Gradle metadata, LSP, or repository
  signatures before broad text search when they are available.
- Emit deterministic OKF concept documents. Use standard OKF fields first and
  producer extensions such as `code_sources` only for code evidence.
- Hooks are advisory unless the user explicitly asks for blocking enforcement.

## Workflow

1. Define the knowledge boundary.
   Identify repository, audience, source roots, OKF output root, and refresh
   scope.

2. Build source evidence.
   Gather Gradle/module/source-set facts, public APIs, generated contracts,
   signatures, tests, and citations before drafting.

3. Plan the page set.
   Choose stable concept paths, `type` values, titles, source files, symbols,
   and cross-links. Avoid concepts backed only by institutional memory.

4. Write source-backed OKF Markdown.
   Every non-reserved concept document needs YAML frontmatter with non-empty
   `type`. Claims should trace to concrete sources.

5. Check impact.
   Use `code_sources` to identify concepts affected by changed files.

6. Validate.
   Run `scripts/code_kb.py check` or `impact`, plus the repository's docs or
   contract checks when available.

## Reference Routing

- Read [knowledge-page-contract.md](references/knowledge-page-contract.md) when
  creating, checking, or modifying OKF concept documents.
- Read [kotlin-gradle-okf-principles.md](references/kotlin-gradle-okf-principles.md)
  when generating OKF bundles for Kotlin/Gradle repositories.
- Use [scripts/code_kb.py](scripts/code_kb.py) for deterministic OKF checks and
  impact lookup.

## Completion Criteria

- Each concept has a stable path and non-empty frontmatter `type`.
- Claims are backed by source paths, symbols, schemas, commands, or generated
  contracts.
- Impact checks identify stale or affected pages from changed files.
- Provider-specific hooks or plugin payloads are adapter projections only.
- Validation evidence is recorded before generated docs are trusted.
