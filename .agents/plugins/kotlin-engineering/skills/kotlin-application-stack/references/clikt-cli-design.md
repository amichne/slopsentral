# Clikt CLI design

Use current [Clikt documentation](https://ajalt.github.io/clikt/) as the API
authority. Treat Kast as a rough local precedent for one canonical command
graph, noun-based command families, typed actions after parsing, local help that
does not start runtime services, deterministic output, and command-contract
tests. Kast is not a template or dependency.

## Design one unsurprising command language

- Use one root command and one command graph. Group related operations under a
  stable domain noun, then use verb leaves such as `project list` or
  `project inspect`. A small single-purpose CLI may use direct verbs.
- Use lower-case kebab-case for commands and long options. Add a short option
  only when users can reasonably expect it across common CLIs.
- Use arguments for the command's primary required identity. Use options for
  modifiers, alternate sources, limits, formats, and behavior choices.
- Keep one name for one concept across sibling commands. Reuse option names and
  meanings such as `--output`, `--format`, `--limit`, and `--config` only when
  they are semantically identical.
- Print root or group help when no leaf is selected. Invoke a default action
  only when it is safe, reversible, cheap, and clearly the common meaning of
  the parent command.
- Use `default` or `defaultLazy` for values that remove needless input without
  hiding a consequential choice. Show defaults in help.
- Parse choices, paths, numbers, and semantic values through Clikt converters.
  Refine them into domain-owned command types before business logic runs.
- Keep Clikt command classes as adapters. A small command may call a domain
  capability directly. A larger CLI should first produce a typed command or
  request, then let an application shell execute effects.
- Keep stdout stable for successful machine output. Send diagnostics and
  progress to stderr. Define exit codes and JSON shapes when another program
  consumes the command.

## Ship completion with the command graph

- Expose one documented completion path with Clikt's `completionOption` or
  `CompletionCommand`. Prefer a visible `generate-completion <shell>` command
  for a CLI that already uses command families. Do not expose several ways
  without a compatibility reason.
- Support bash, zsh, and fish unless the product has a narrower shell contract.
- Add fixed, path, host, user, or custom completion candidates where they save
  lookup work. Keep custom completion fast, bounded, deterministic, and safe
  when the network is unavailable.
- Generate completion from the same graph that parses commands. Regenerate and
  reinstall scripts when the graph changes.
- Emit only the completion script on stdout. Send failures to stderr with a
  nonzero exit status.

## Test the public CLI

- Use Clikt's command test support. Use `echo` for output that tests must
  capture; Kotlin `print` and `println` are not captured by Clikt's test helper.
- Test root help, every command family's help, the common default path, an
  explicit override, and each leaf's routing.
- Prove that help, version, and completion do not initialize network clients,
  servers, or other application runtime services.
- Test missing, malformed, conflicting, duplicated, and unsupported inputs.
  Assert the exit status and the correct output stream.
- Test the typed command or request separately from its effectful service.
- Generate completion for each supported shell. Check command, option, choice,
  and custom candidates that form part of the public contract.
- Run a packaged-binary smoke test for `--help`, `--version`, completion, one
  successful command, and one expected failure.

## Official guidance

- [Nested commands](https://ajalt.github.io/clikt/commands/)
- [Options and defaults](https://ajalt.github.io/clikt/options/)
- [Shell autocomplete](https://ajalt.github.io/clikt/autocomplete/)
- [Testing commands](https://ajalt.github.io/clikt/testing/)
