# Provenance

Source reviewed 2026-09-05:
oakoss/agent-skills: github-actions at 85e3a3919d9e0ec7f7302a5143ec4b3e66f5f6ad.
The upstream skill declares MIT in its metadata. This local procedure is
independently authored; no upstream files, scripts, examples, or templates are
copied. Preserve the applicable upstream license and notices before importing
literal material in a future update.

Retained ideas: focused task selection, explicit inputs and outputs, bounded
verification, and reference-driven detail. Removed assumptions: named host agents,
automatic installation or trust, universal vendor preferences, fixed branching
rules, and unsupported speed claims. Verify tool-version details with official
documentation before changing commands.


## Gradle and CI Performance Extension

Reviewed 2026-09-16:
agents-inc/skills: infra-ci-cd-github-actions,
from the user-supplied
The reviewed revision remains the attribution record.
This is an independent adaptation into the existing Actions owner, not an imported
skill or copied template. Preserve actual license/notices before future literal
imports.

Retained: affected work, deliberate cache layers, required quality gates, bounded
parallelism, reusable workflows, explicit versions, scoped OIDC, artifact
promotion, rollback, and CI monitoring. Adapted to Gradle consumer closures,
native report correlation, and Actions runner/transport costs. Rejected:
unconditional full-suite bans, fixed five-minute/80% targets, unsupported savings
percentages, mandatory install-job barriers, and mutable version examples as
security proof. Targets follow measured workloads; uncertain impact widens checks.
The existing workflow graph and trust references remain authoritative local
contracts. Official Gradle Actions and GitHub documentation govern implementation.
