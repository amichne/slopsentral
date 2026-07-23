---
name: "terminal-ui-design"
description: "Design and implement distinctive human-facing terminal interfaces. Use when building or refining interactive TUIs, terminal dashboards, wizards, prompts, progress displays, or styled CLI output; use cli-creator instead when the primary deliverable is an agent-facing command surface or JSON contract."
---

# Terminal UI Design

Create intentional terminal interfaces without sacrificing terminal behavior.
Reuse the project's existing language, UI framework, and conventions before
introducing new dependencies or raw ANSI control sequences.

## Operating Contract

- Start from the user's primary task, audience, workflow, and existing code.
- Choose one aesthetic thesis and one memorable motif. Restraint is a valid
  direction; distinctiveness does not require maximal decoration.
- Preserve existing exit codes, stdout/stderr separation, machine-readable
  modes, quiet modes, and redirected output.
- Never encode meaning through color, glyph shape, or motion alone.
- Keep the interface usable after resize, at its minimum supported width, with
  color disabled, and when Unicode support is unavailable.
- Restore terminal state on success, failure, cancellation, and interruption.

## Workflow

1. Establish the interface contract.
   Inspect the application flow, terminal stack, supported platforms, and
   output contracts. Map startup, loading, empty, content, success, and failure
   states that apply. Finish when the primary task and every reachable state
   are accounted for.

2. Choose the visual thesis.
   Define the tone, density, palette roles, border and glyph family, motion
   posture, and one signature motif in a single coherent direction. Read
   [design-language.md](references/design-language.md) when choosing or revising
   that direction. Finish when every visual choice reinforces the interface's
   purpose rather than a generic terminal aesthetic.

3. Build hierarchy before decoration.
   Place the primary action and information first, then navigation, context,
   help, and chrome. Define focus order, keyboard paths, compact behavior,
   truncation, wrapping, and stable regions for live updates. Finish when the
   complete workflow remains clear in monochrome with animation disabled.

4. Apply the visual system.
   Centralize semantic style tokens and use a consistent spacing rhythm,
   alignment scheme, glyph vocabulary, and state treatment. Add borders,
   texture, charts, and motion only where they clarify structure or feedback.
   Finish when every mapped state uses the same visual grammar.

5. Harden terminal behavior.
   Use the framework's capability detection and cleanup primitives. Honor
   `NO_COLOR` and existing accessibility or animation settings; provide plain
   output for non-interactive streams; handle resize, cancellation, and partial
   rendering without corrupting the shell. Finish when degraded modes preserve
   all information and actions.

6. Verify the result.
   Run the smallest focused checks available, then exercise the interface in a
   real terminal at normal and narrow widths, with color disabled, through its
   keyboard flow, and across every mapped state. For CLI output, also redirect
   stdout and confirm structured modes remain parseable. Finish only when all
   exercised paths render cleanly and terminal state is restored.

## Completion Criteria

- The implemented interface completes the user's primary workflow.
- Its visual thesis is recognizable and consistently applied.
- Every reachable state and degraded mode remains legible and operable.
- Existing CLI output contracts and terminal cleanup behavior still pass.
