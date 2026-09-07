# Astra Workstream Scenarios

Status: authored acceptance scenarios, not observed model results. Run in a
throwaway local worktree with gpt-6-astra and only the relevant plugin selection.
Do not perform remote writes, publish a site, deploy, or access production secrets.
Record the actual loaded skill, completed artifact, checks, unsupported claims,
and unnecessary pauses before drawing conclusions about behavior or token use.

| Prompt | Primary skill | Required behavior | Failure to reject |
| --- | --- | --- | --- |
| Flatten this Kotlin decision without changing effects. | kotlin-branching | Check language support, cover remaining guarded cases, preserve evaluation order. | Add `else` to silence a closed-domain compile error. |
| Decide whether this operation belongs on the receiver or a service. | kotlin-api-surface-design | Inspect real callers and choose a semantic owner. | Create a generic helper solely for fluent syntax. |
| Replace these request flags with a constrained domain model. | kotlin-design-practices | Name the invariant and eliminate invalid combinations at ingress. | Treat branch formatting as domain modeling. |
| Extract named fields from JSON for files matching this pattern. | cli-data-pipelines | Bound search, preserve argument/data boundaries, distinguish no-match from error. | Parse structured data with an unsafe interpolated replacement. |
| Add Zsh completion without breaking the user's prompt. | shell-session-integration | Own registrations, support repeated loading, preserve status and existing hooks. | Replace prompt state or run network work on every completion. |
| Make this mise task run identically in CI. | mise-project-tooling | Inspect pins and trust, run non-interactively, verify resolved versions. | Require interactive activation or trust unreviewed config. |
| Design promotion of one tested artifact across two environments. | delivery-pipeline-design | Name artifact identity, evidence, trust transitions, and recovery. | Rebuild an unverified artifact per environment. |
| Repair this failed GitHub Actions run. | github-ci-operations | Inspect actual logs and workflow, fix the owner, verify the changed head. | Rerun a known deterministic failure or require an unavailable local observer. |
| Write an on-call runbook from these files. | technical-documentation | Separate symptoms, diagnosis, authorized recovery, and verified examples. | Invent commands or production success output. |
| Keep this review reply to two sentences using only the supplied facts. | controlled-technical-writing | Preserve factual and personal grounding and the requested length. | Invent first-person measurements or expand into an essay. |
| Split this independent implementation and read-only review. | bounded-delegation | Assign bounded ownership and inspect the resulting evidence. | Assume unavailable agents or assign competing edits. |
| The one-sentence comment is already accurate; check it. | controlled-technical-writing | Preserve the no-change result. | Rewrite merely to demonstrate activity. |

For multi-step tasks, record supporting skills separately from the primary
skill. Loading several complementary skills is not itself a routing failure.
A static identity/ownership check does not score these behavioral criteria.
