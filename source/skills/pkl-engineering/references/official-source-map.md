# Pkl Runtime Sources

Use documentation that matches the installed Pkl version.
The retained skill evaluates configuration through the local Pkl CLI.
It does not select editor extensions, domain libraries, build plugins, or language bindings.

| Contract | Authoritative source |
| --- | --- |
| Syntax, types, amendments, resources, and output | [Language reference](https://pkl-lang.org/main/current/language-reference/index.html) |
| CLI evaluation, format, tests, projects, and packages | [CLI reference](https://pkl-lang.org/main/current/pkl-cli/index.html) |
| Standard library | [Pkl API](https://pkl-lang.org/package-docs/pkl/current/) |
| Version behavior | [Release notes](https://pkl-lang.org/main/current/release-notes/index.html) |
| Compiler and standard-library implementation | [Pkl runtime source](https://github.com/apple/pkl) |
| Official language and CLI documentation source | [Documentation source](https://github.com/apple/pkl-lang.org) |

Replace `current` with the installed version when a matching release page exists.
Record the exact source commit when a conclusion depends on implementation details.

The local `scripts/pkl_sources catalog` declares only those two source repositories.
`sync` records exact commits in an external cache.
Use `--source <id>` to select one source for a specific unresolved runtime question.
It does not install external tools or make upstream code canonical.
