# Signature Text Contract

For a line-oriented `.sig` format, keep entries stable and machine-readable:

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

Use an `INDEX.sig` file containing one sorted relative path per generated
signature file. If a repo chooses JSON instead, model the same facts with a
closed schema before writing the files.
