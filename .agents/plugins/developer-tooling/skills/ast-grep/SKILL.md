---
name: "ast-grep"
description: "Install and configure ast-grep, search code with AST patterns, author YAML rules, and apply structural rewrites. Use for syntax-aware matches, reusable lint rules, and codemods across supported grammars."
---

# ast-grep

Use ast-grep for structural search and rewrites in a supported grammar.
Use compiler or LSP tools for symbol identity, type resolution, references, and semantic rename.
Use `rg` for literal text and unknown file discovery.

## Procedure

1. Identify the requested language, source paths, exclusions, and search or rewrite outcome.
2. Examine the installed `ast-grep` executable, version, help output, and existing `sgconfig.yml`.
3. For installation or missing grammar support, read [installation and languages](references/installation-and-languages.md).
4. For patterns, YAML rules, or rewrites, read [structural rules](references/structural-rules.md).
5. Select an explicit grammar and the smallest source scope that covers the task.
6. Compare the pattern with a known match and its nearest non-match before a broad scan.
7. Use read-only output to examine actual matches and file paths.
8. For a rewrite, examine replacement output before a source write.
9. Apply the requested rewrite only to the examined scope.
10. Examine the diff and run the language's compiler, formatter, or focused tests that cover the changed behavior.
11. Report exact commands, matches, changed files, excluded paths, and semantic limits.

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
