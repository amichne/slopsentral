---
name: "issue-tracker-operations"
description: "Use when Effective Delivery must select GitHub or Jira as an issue backend, read an issue, inspect direct blockers, or report exact backend capabilities."
---

# Issue Tracker Operations

Use this skill for backend-neutral issue reads in Effective Delivery. Use the
facade instead of branching on provider commands in the model.

## Operating Contract

- Resolve the backend before issue work starts.
- Use `--backend` for an invocation-specific override.
- Otherwise, use `EFFECTIVE_DELIVERY_ISSUE_BACKEND`.
- Set the value to `github` or `jira`.
- Set `EFFECTIVE_DELIVERY_GITHUB_REPOSITORY` to `owner/repository` for GitHub reads.
- Use native `gh` for GitHub.
- Use Atlassian `acli` for Jira.
- Do not use the stale `jira-resolve-ticket` primitive as a Jira adapter.
- Treat blocker links and parent-child containment as different relationships.
- Do not infer transitive completeness from the direct blocker map.
- Reject unsupported operations before provider execution.

## Workflow

1. Inspect capabilities.

   Run `scripts/issue_backend capabilities --json`.

2. Read the issue.

   Run `scripts/issue_backend view IDENTIFIER --json`.

3. Read direct blockers when dependency order matters.

   Run `scripts/issue_backend dependency-map IDENTIFIER --json`.

4. Check the result type.

   Accept `COMPLETE` only for the requested operation and declared coverage.
   Treat `REJECTED` as failure. Use its stable failure identifier for recovery.

5. Stop at the capability boundary.

   This version does not create, update, comment on, or reparent issues. Do not
   bypass the facade with a provider-specific write.

## Reference Routing

- Load [issue-backend-contract.md](references/issue-backend-contract.md) for
  normative requirements, dependency gates, failure rules, and evidence links.
- Load [issue-backend-result.schema.json](references/issue-backend-result.schema.json)
  when changing the canonical JSON result.

## Completion Criteria

- The selected backend is explicit in the result.
- Provider output is normalized before model use.
- Direct blocker direction is preserved.
- Coverage distinguishes direct blockers, hierarchy, and transitive traversal.
- Each provider command appears as structured evidence.
- Unsupported work remains rejected or marked `UNSUPPORTED`.
