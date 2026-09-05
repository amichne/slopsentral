---
name: shell-session-integration
description: "Use when implementing Bash, Zsh, or Fish completion, prompt hooks, shell wrappers, activation, or terminal cleanup without breaking existing shell state."
---

# Shell Session Integration

Integrate with the caller's shell without taking ownership of the whole session.
This skill owns interactive session behavior; standalone automation belongs to
shell-script-safety and machine-readable queries to cli-data-pipelines.

## Workflow

1. Identify supported shells and versions, interactive versus non-interactive
   entrypoints, startup files, and existing completion or prompt registrations.
2. Keep the executable's data interface separate from shell-specific sourceable
   integration. Generate completions from authoritative CLI metadata when possible.
3. Register only names owned by this tool. Repeated sourcing must not duplicate
   callbacks, PATH entries, key bindings, or completion registrations.
4. Preserve argument boundaries with quoted arguments. Preserve the previous
   command's status and existing hooks. Do not replace a user's prompt callback
   or evaluate untrusted completion output as shell code.
5. Use native shell APIs and local option scope. Make non-interactive execution
   quiet. Restore terminal state and temporary resources on normal exit and signals.
6. Test loading twice, an existing hook, spaces in paths, a failed wrapped command,
   and a non-interactive invocation in each supported shell.

## References

Read [shell boundaries](references/shell-boundaries.md) when choosing completion,
hook registration, startup loading, or teardown behavior.

## Completion Criteria

Each supported shell passes its focused tests. Existing user configuration and
exit statuses survive. Unsupported shells are named explicitly. Installing or
editing personal dotfiles occurs only when that change is requested.

Read [provenance](references/provenance.md) when updating this skill.
