# Structural Rules

## Search without source writes

Use explicit paths and the requested grammar.
Single quotes preserve metavariables through the shell.

```sh
ast-grep run --lang ts --pattern 'console.log($$$ARGS)' --json=compact src/
```

This pattern matches syntax regardless of whitespace.
It does not resolve the identity of `console` or prove a runtime effect.
Use [pattern syntax](https://ast-grep.github.io/guide/pattern-syntax.html) for captures and contextual fragments.
Use the installed command's `--debug-query` option when the pattern parses into an unexpected node.

## Keep a reusable rule

The bundled assets supply one rule, its project configuration, and its positive and negative cases.
From this skill directory, run:

```sh
ast-grep test --config assets/sgconfig.yml --skip-snapshot-tests
```

The cases distinguish `console.log` calls from comments, string content, and another method.
In ast-grep cases, `invalid` means that the rule must match.
The `valid` cases must produce no match.
The command omits diagnostic snapshots and proves match selection only.
It does not prove replacement behavior.

For a repository rule, use its existing `sgconfig.yml` and directories.
Do not initialize or replace a second project configuration over the current one.
Keep one stable rule `id` across the rule and its cases.
Use [rule configuration](https://ast-grep.github.io/reference/yaml) for constraints, relations, and fixes.
Use the [rule test guide](https://ast-grep.github.io/guide/test-rule.html) for diagnostic and fix snapshots.
Keep expected replacement text independent of generated output.
Examine snapshot updates before acceptance.

```sh
ast-grep scan --rule assets/rules/no-console-log.yml --json=compact src/
ast-grep scan --config sgconfig.yml --json=compact src/
```

The first command selects one rule.
The second selects the repository's configured rules.
Examine the selected rule count and input files before a complete-coverage claim.

## Preview and apply a rewrite

This example changes a method name while it keeps the captured arguments.
It illustrates syntax, not a recommendation to change a logging policy.

```sh
ast-grep run --lang ts --pattern 'console.log($$$ARGS)' --rewrite 'console.info($$$ARGS)' src/
```

Without `--interactive` or `--update-all`, the CLI prints the proposed replacement without source writes.
Examine that preview and the negative cases first.
If the task authorizes the examined rewrite, apply the same pattern, grammar, replacement, and scope.

```sh
ast-grep run --lang ts --pattern 'console.log($$$ARGS)' --rewrite 'console.info($$$ARGS)' --update-all src/
```

Examine the Git diff after the write.
Run the changed language's formatter and focused compiler or behavioral tests.
Use a semantic tool when the rewrite depends on types, imports, shadowed names, or symbol identity.
