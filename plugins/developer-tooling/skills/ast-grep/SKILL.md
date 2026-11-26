---
name: "ast-grep"
description: "Use for syntax-aware code search, reusable AST lint rules, structural rewrites, or requested ast-grep setup across supported grammars. Use literal search for text and compiler or LSP tools for resolved symbol identity."
---

# ast-grep

Use ast-grep for structural search and rewrites in a supported grammar.
Use compiler or LSP tools for symbol identity, type resolution, references, and semantic rename.
Use `rg` for literal text and unknown file discovery.

## Procedure

1. Identify the requested language, source paths, exclusions, and outcome.
   Select literal search, structural matching, or semantic tooling from the claim the result must support.
2. When structural matching is needed, examine the installed `ast-grep` executable,
   version, help output, existing `sgconfig.yml`, and rules that may already cover the task.
   Reuse a suitable rule. For requested setup or missing grammar support, read
   [installation and languages](references/installation-and-languages.md) before changing the installation.
3. Before authoring a pattern, YAML rule, or rewrite, read
   [structural rules](references/structural-rules.md). Select an explicit grammar
   and the smallest source scope that covers the task.
4. Compare the pattern with a known match and its nearest non-match before a broad scan.
   Use read-only output to examine actual matches and file paths.
   For a search request, report those results without applying a rewrite.
5. For a requested rewrite, examine replacement output before a source write.
   Apply it only to the examined scope. Examine the diff and run the language's
   compiler, formatter, or focused tests that cover the changed behavior.
   For a reusable lint rule, exercise its positive and negative cases with `ast-grep test`.
6. Report exact commands, matches, changed files, excluded paths, and semantic limits.

## Rules

Prefer the full `ast-grep` executable name.
The `sg` command can identify an unrelated system program.
Keep metavariables inside single-quoted shell arguments.
Use `$$$ARGS` for a sequence and `$ARG` for one syntax node.
Repeated named metavariables constrain matches to equal syntax.
Use structured patterns when context or a node selector disambiguates a fragment.
Keep unsupported grammars explicit.
Do not silently substitute a nearby language grammar.

Use `--json=compact` for a bounded result or `--json=stream` for a stream of matches.
Keep parser errors and command failures separate from zero matches.
Do not use `--update-all` during discovery or a preview.
Do not disable ignore rules or extend the source scope without a task reason.
Treat a structural match as syntax evidence only.
An AST match does not prove a resolved callee, runtime behavior, or safe refactoring.

## Completion

A search result includes its grammar, paths, pattern or rule, and match evidence.
A reusable rule includes positive and negative cases under `ast-grep test`.
A rewrite includes the examined diff and language-level results.
Keep absent semantic or real-host evidence explicit.
The bundled console rule illustrates command use and does not impose repository policy.
