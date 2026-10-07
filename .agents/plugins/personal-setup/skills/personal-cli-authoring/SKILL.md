---
name: personal-cli-authoring
description: "Craft parameterized, composable personal command-line tools with reusable building blocks, shell completions and source-backed --teach guidance using the caller's directory, recent command summaries and an optional question. Use when creating or extending the user's shell utilities, especially amichne/shell-config tools; not for ordinary command execution or agent-facing API wrappers."
---

# Personal CLI Authoring

Build a tool the user can understand, compose and extend. Start from a concrete
task and the existing implementation; add only the missing capability.

## Workflow

1. Read the owning source, launchers, callers and checks. For shell-config,
   establish installation authority with `personal-setup-management` when
   available. For API-to-agent command surfaces, use `cli-creator` instead.
2. Read [building blocks](references/command-building-blocks.md) when designing
   flags, parameter precedence, data flow or extensions. Define one useful
   composition before choosing an abstraction. Separate parsing, pure selection
   and transformation, effects, and presentation. Keep meaningful facts refined
   and represent expected failures as finite variants.
3. Choose defaults from the verified setup and expose real variation through
   flags or validated configuration. Preserve argument boundaries, exit status,
   stdin/stdout composition and offline static `--help`.
4. Include completion for supported shells, generated from authoritative option
   definitions where available. Prioritize the user's existing Zsh installation.
   Completion must be local, fast and free of network or mutation effects.
5. Read [teaching contract](references/teach-mode.md) when adding `--teach`.
   Reuse [teach.mjs](scripts/teach.mjs), or implement its contract in the tool's
   existing runtime. Feed the exact command source and its relevant modules,
   the caller's directory, bounded session-history summaries and optional
   question. Keep preview local and assistant transport replaceable.
6. Use the retained [sample tool](assets/personal-size.mjs) and
   [Zsh history wrapper](assets/personal-size.zsh) when a Node-based starting
   point fits. Adapt source paths and installation to the real owner. Templates
   are examples, not an instruction to replace an existing runtime.
   Preserve the sample's [JSON contract](assets/personal-size-result.schema.json)
   when adapting its output.
7. Prove the changed behavior with the narrow owning check: normal composition,
   parameter bounds, stdout/JSON contract, help without an assistant, completion,
   teach context, missing source, assistant failure and shell integration if
   changed. Do not call a deterministic adapter test observed model quality.

## Completion

Provide copyable normal and composed examples, `--teach` with and without a
question, supported completions, parameter precedence and the focused passing
check. Name assistant requirements and any unavailable context. Installation,
publication and edits to other tools require their applicable task scope.
