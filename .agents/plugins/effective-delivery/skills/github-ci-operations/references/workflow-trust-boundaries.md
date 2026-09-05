# Workflow Trust Boundaries

Read the current repository policy and GitHub Actions documentation before
changing workflow syntax, permissions, or action versions. Use reviewed immutable
commit references for external actions where policy requires pinning; do not
invent a current version or SHA.

Keep untrusted pull-request code away from privileged `pull_request_target` or
publishing jobs. Pass untrusted expression values through environment variables
and quote shell arguments instead of interpolating expressions into shell code.
Scope permissions to the job and action that needs them. An OIDC token is useful
only with an appropriately constrained trust policy at the receiving service.

A cache accelerates work; it does not establish that an artifact passed required
checks. Tie artifacts and deployment evidence to the source and artifact identity.
Set timeouts and concurrency from failure behavior. Canceling a validation job and
canceling a deployment can have different consequences.

Check required-status behavior for skipped paths and relevant merge-queue events.
Matrix expansion changes cardinality. Reusable workflows share an interface;
composite actions share steps. Choose the boundary that removes actual duplicated
responsibility instead of maximizing abstraction.

Sources: https://docs.github.com/en/actions/security-for-github-actions
and https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
(recheck against the repository's supported platform when applying).
