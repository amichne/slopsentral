---
name: "shell-script-safety"
description: "Write, review, or harden Bash and shell automation used by hooks, CI, release scripts, installers, and local developer tooling. Use when shell scripts need predictable failure handling, quoting, dry-run boundaries, temporary-file cleanup, argument parsing, or safer destructive-operation guardrails."
---

# Shell Script Safety

Use this skill when shell code needs to become durable automation. The goal is
not to make every command elaborate; it is to make scripts fail clearly,
preserve data, and remain maintainable when run by agents, hooks, CI, or humans.

## Operating Contract

- Confirm the target shell before choosing Bash-only features.
- Prefer a short script with explicit checks over a dense pipeline that hides
  failure behavior.
- Treat destructive operations as opt-in: require dry-run support,
  confirmation, or an explicit force flag before mutation.
- Quote variables, use arrays for argument lists, and avoid string-built
  commands.
- Keep temporary files under a managed directory and clean them up with traps.
- Emit errors to stderr and reserve stdout for structured or user-requested
  output.
- If the script emits persisted structured data, define or reuse the schema,
  parser, or validator before writing it.
- Prefer reusable repo scripts over long inline CI workflow shell when the logic
  is shared, stateful, or needs local reproduction.

## Workflow

1. Identify the execution boundary.
   Record shell, OS assumptions, working directory, environment variables,
   required tools, and whether the script runs locally, in CI, or as a hook.

2. Choose strictness deliberately.
   For Bash scripts, start from `set -Eeuo pipefail` unless a command sequence
   requires narrower handling. For POSIX `sh`, avoid Bash arrays and `[[ ]]`.

3. Make inputs explicit.
   Validate required args, env vars, files, directories, and commands before
   doing work. Prefer one `usage` function and clear exit codes.

4. Protect file and process handling.
   Quote expansions, use `--` before path arguments when supported, use
   null-delimited file lists for arbitrary paths, and avoid parsing display
   output when a structured command option exists.

5. Add cleanup and rollback boundaries.
   Use `mktemp -d` for scratch space, `trap` for cleanup, and write mutation
   plans before applying broad changes. Prefer moving or linking only after
   validation passes.

6. Test the important paths.
   Run syntax checks, a dry-run path, a success path, and at least one expected
   failure path. For hooks and CI scripts, resolve `<skill-root>` to this
   skill's installed directory and run the bundled helper with explicit paths:

   ```sh
   python3 "<skill-root>/scripts/check_shell_safety" <script.sh>
   bash -n <script.sh>
   ```

## Reference Routing

Read [review-patterns.md](references/review-patterns.md) when reviewing a
script or adapting Bash templates for cleanup, path walks, or argument arrays.

## Completion Criteria

- Shell and runtime assumptions are explicit.
- Required inputs and tools are validated before mutation.
- Destructive behavior has a reviewable safety boundary.
- Syntax checks and representative success/failure paths have been run.
- Structured outputs have schema, parser, or validator coverage.
