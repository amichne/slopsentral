---
name: mise-project-tooling
description: "Use when configuring mise tool versions, project environments, task dependencies, or matching local and CI execution without relying on interactive shell activation."
---

# Mise Project Tooling

Use repository-owned tool and task configuration as the environment contract.
Retain a working native build system; mise may invoke it without becoming a
second owner of its dependency graph.

## Workflow

1. Inspect existing mise configuration, lockfiles, wrappers, task entrypoints,
   CI setup, installed mise version, and tool backends. Diagnose before migrating.
2. Pin the versions required by the repository. A major version or `latest` is a
   moving constraint, not an exact toolchain pin. Use the installed version's
   supported lock mechanism when the project requires reproducibility.
3. Review configuration before trusting or executing it. Templates, hooks, task
   commands, plugins, and environment sources can execute code. Do not run
   `mise trust` or alter global configuration merely to suppress a warning.
4. Use `mise exec -- <command>` for a command or `mise run <task>` for a declared
   task in scripts and CI. Interactive activation is a separate shell integration;
   do not make a script depend on a prompt callback having run.
5. Give tasks real prerequisites and outputs. Delegate Gradle, package-manager,
   or compiler semantics to the repository's established entrypoint. Avoid parallel
   tasks that mutate the same output, environment, or remote target.
6. Check tool resolution and run the focused task in a clean non-interactive
   shell. Report downloads or unavailable tools separately from task failure.

## References

Read [environment and task boundaries](references/environment-and-tasks.md)
for task ownership, secrets, configuration trust, and the local/CI parity check.

## Completion Criteria

The intended versions and environment resolve without interactive activation.
The task's exit status reaches its caller, secrets stay outside committed
configuration, and required local/CI differences are explicit.

Read [provenance](references/provenance.md) when updating this skill.
