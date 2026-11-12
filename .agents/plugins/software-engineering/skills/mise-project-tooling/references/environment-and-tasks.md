# Environment and Task Boundaries

`mise exec -- java -version` checks the environment of that process.
`mise run test` executes an existing repository task. Neither command needs an
interactive prompt hook first. Use the repository working directory so discovery
uses the intended project configuration.

Do not infer parity from executable names alone. Compare resolved versions,
required environment variables, working directory, platform, and task arguments.
A toolchain manager does not remove native platform differences.

Task dependencies establish ordering, not semantic cache correctness. Declare
source/output shortcuts only when those inputs fully determine the output. Keep
an underlying build tool's incremental and dependency rules authoritative.

Environment files may contain credentials. Ignore secret files, avoid dumping
whole environments, and do not copy secrets into tool logs or generated docs.
Trust is an execution decision, not a setup checkbox. Inspect the exact changed
configuration before permitting its templates, hooks, plugins, or tasks to run.

Official references, checked 2026-09-05:
- https://mise.jdx.dev/faq.html
- https://mise.jdx.dev/troubleshooting.html
- https://mise.jdx.dev/tasks/

Recheck installed-version documentation before introducing optional flags or
security modes. A documented feature in main may not exist in a pinned release.
