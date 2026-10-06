# Worktrunk Automation

Use the upstream `worktrunk@worktrunk` plugin alongside Software Engineering.
See the [marketplace reference](agent-marketplaces.md) for installation and
provenance. Slopsentral extends git-change-flow with worktree isolation, current
remote bases, task staging, and blocking verification.

The repository's [project configuration](../.config/wt.toml) automates:

| Boundary | Command | Effect |
| --- | --- | --- |
| Worktree creation | `npm ci` | Installs locked dependencies before agent handoff |
| Worktrunk commit | `npm run check:source` | Validates source graph, catalog freshness, and diff whitespace |
| Worktrunk local merge | `npm run verify` | Rechecks source, runs Node tests, projects both providers, and tests projected Codex hook output |
| Manual verification | `wt verify` or `npm run verify` | Runs that verification without committing or merging |

Worktrunk parses the TOML and previews hooks with `wt hook show --expanded`.
Project commands need Worktrunk approval before their first execution. Inspect
the expanded commands and use existing authorization for the reviewed task;
do not treat skipped commands as successful verification.

`npm run verify` requires Node dependencies and projeKtor on PATH. Use
projeKtor v1.2.1 to match the pinned CI projection contract. The projection
script creates a unique temporary directory per invocation and removes only
that directory on success or failure. Generated provider trees in the checkout
are updated by the existing publication workflow.

For a fresh CLI worktree, fetch the intended base, resolve its full commit,
and pass it to `wt switch --create <branch> --base <commit> --format=json`.
Verify the returned path and its HEAD before working there. Stage only task
files before `wt step commit --stage=none`; Worktrunk's default stages all
changes. Host-managed worktrees use the host's creation and archival tools.

The hooks run on Worktrunk operations. Raw Git and host tools must invoke the
canonical verification command explicitly. Source verification checks unstaged,
staged, and committed task changes using `origin/main...HEAD` for the committed
range. Fetch the `main` base before verification; an unavailable base or merge
base fails the gate. Local merge automation and upstream
activity markers do not authorize remote publication, extra agent sessions,
deployment, or worktree deletion. Required hosted CI still needs terminal
success at the exact current PR head.

Run `node --test tools/tests/worktrunk-automation.test.mjs` with `wt` on PATH
to exercise lifecycle success and rejection paths. Those tests skip locally
when the CLI is unavailable. CI installs checksum-pinned Worktrunk v0.53.0;
a missing CLI fails the lifecycle tests. Projection runner tests are always
part of `npm test`.
These executable checks establish hook and command behavior; native model
routing and host consumption need separate observation.
