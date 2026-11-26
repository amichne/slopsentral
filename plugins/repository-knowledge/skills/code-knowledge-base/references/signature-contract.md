# Signature Contract

Generate source maps for navigation, API drift, and source citations.
An index selects source reads. It does not prove implementation behavior.

## Generation Procedure

1. Select source roots, generated-source exclusions, languages, package conventions, and the output directory.
2. Define file names, path mappings, fields, ordering, and an explicit outcome for unknown syntax before generation.
3. Use semantic tools or a language parser for signatures when available.
   For JVM types, preserve fully qualified names and source identity.
4. Sort files and symbols, normalize whitespace, and exclude timestamps.
5. Examine a multi-type file, a file without a top-level type, and a package or import edge case.
6. Generate twice from identical source and compare bytes.
7. Change a public signature in a fixture and make sure that the drift procedure rejects stale output.
8. Map changed source files and symbols to concepts that cite those signatures.

Regenerate after package moves, refactors, generated-source changes, or public API changes.
Do not edit generated signature files by hand.
Keep the contract near the generator or in repository documentation.

## Text Format

A line-oriented `.sig` format can use these fields:

```text
file=<relative source path>
package=<package or default>
imports=<comma-separated imports>
type=<fqcn>|kind=<class|interface|object|enum|...>|decl=<normalized declaration>
fields:
- <normalized field signature>
methods:
- <normalized method signature>
contracts:
- <generated route/schema/command/catalog identifier>
```

Use an `INDEX.sig` with one sorted relative path per signature file.
For JSON output, define a schema with explicit fields and rejection of unknown properties.
State source-path mappings and generator identity in the output contract.
Use a locked uv environment for new Python automation, with strict Pyright, Ruff, and pytest.
