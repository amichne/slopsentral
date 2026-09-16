# Upstream Review

Reviewed 2026-09-05. Local skills retain task-specific ideas and use original
wording and examples instead of importing a second full skill collection.
Per-skill provenance travels with standalone installations.

## Model Guidance

[OpenAI model guidance, GPT-6 Astra](https://developers.openai.com/api/docs/guides/latest-model)
is the basis for the execution adapter. The page is mutable; the review date is
not an immutable version. Recheck it when revising the adapter. No API key, model
account setting, or live deployment setting is changed by this catalog.

## Source Revisions

| Source | Reviewed revision | Local use |
| --- | --- | --- |
| chrisbanes/skills | `84c2c53a26614236e644b3ea9eaf891c44704417` | Kotlin API ownership, branching, and grounded writing |
| oakoss/agent-skills | `85e3a3919d9e0ec7f7302a5143ec4b3e66f5f6ad` | CLI pipelines, shell integration, Git, Actions, CI/CD, mise, and technical docs |
| amichne/projeKtor | `v1.2.0`, action commit `188fee849d42e6106abfe62ab6b6b33a9ec9c8dd` | Required provider projection contract |

Chris Banes's distribution uses Apache-2.0; the relevant standalone skills
include the license and modification notice. Oakoss skill frontmatter declares
MIT. The Oakoss-inspired local procedures copy no upstream source files,
scripts, examples, or templates. Future literal imports must retain the actual
upstream license and applicable notices.

## Adaptation Decisions

Retain semantic function ownership, compiler exhaustiveness, grounded personal
claims, structured CLI data, shell-state preservation, explicit artifact and trust
boundaries, and documentation backed by source evidence.

Do not import blanket requirements for named Explore/Task/Plan agents, automatic
skill installation, automatic mise trust, a universal 48-hour branch rule,
mandatory vendor choices, unsupported speed multipliers, or mandatory diagrams.
Do not inherit another author's persona when writing on behalf of the user.

Official mise documentation was checked through Context7: non-interactive
commands use mise exec or mise run without requiring prompt-driven activation.
[FAQ](https://mise.jdx.dev/faq.html) and
[troubleshooting](https://mise.jdx.dev/troubleshooting.html) resolve conflicting
activation advice in the upstream skill. The installed version remains decisive.

## Task-Oriented Plugin Review

Reviewed 2026-09-16:

- [OpenAI best practices](https://learn.chatgpt.com/guides/best-practices):
  focused skill triggers, relevant context, durable repository guidance, and
  verification matched to the task.
- [Iterating development workflows with Codex](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex):
  adapt workflow artifacts to the project, improve existing owners, and separate
  authored plans from observed evidence.

Local application: one everyday engineering installation, optional specialties,
focused existing skills, and no automatic publication from task descriptions.
The catalog consolidation is our design decision, not an OpenAI-mandated plugin
layout. The example harness files and approval ceremonies are optional; this
marketplace does not create them for every task. Existing authorization remains
valid. No upstream skill or example prompt is copied into canonical source.
