# Pkl Tooling Capabilities

Use this map for the retained local Pkl CLI and facade.
Match its flags and API contract to the installed version.

## Evaluation and rendering

`pkl eval` evaluates a typed module and derives consumer output. The built-in
CLI formats include JSON, Jsonnet, PCF, plist, Java properties, textproto, XML,
and YAML. `output.value` selects the model and `output.renderer` controls its
representation; `output.files` supports bounded multiple-file generation.

- [CLI evaluation and output options](https://pkl-lang.org/main/current/pkl-cli/index.html)
- [Language reference: module output and renderers](https://pkl-lang.org/main/current/language-reference/index.html)
- [Standard library API](https://pkl-lang.org/package-docs/pkl/current/)

Treat JSON and YAML as projections, not parallel authored configuration. Keep
generated artifacts reproducible and check them only when a downstream consumer
requires checked-in output.

## Structured inputs and transformations

- `import*` loads modules; `read*` loads resources.
- Standard-library JSON and YAML modules parse or render structured values.
- Convert `Dynamic` inputs to a typed class before use.
- Use an external resource reader only when a required scheme cannot be modeled
  with built-in file, property, environment, package, or project resources.

See the [language reference](https://pkl-lang.org/main/current/language-reference/index.html)
and [standard-library API](https://pkl-lang.org/package-docs/pkl/current/).

## Tests and formatting

- `pkl format` is the canonical formatter.
- `pkl analyze imports` checks import topology; it does not replace evaluation.
- `pkl test` runs `pkl:test` facts and examples.
- Project tests belong in `PklProject.tests`; package API tests belong in
  `package.apiTests`.

The `pkl-engineering` skill's façade adds bounded TOON output and sandboxes test
and package-verification writes.

## Retained scope

The repository facade uses the Pkl CLI for evaluation, formatting, imports, tests, and package operations.
Repository hooks call that same facade.
No editor extension, external reader executable, build plugin, domain package, or host-language binding is needed by these commands.
Keep a project's existing integration unchanged unless the user explicitly requests work on that integration.
