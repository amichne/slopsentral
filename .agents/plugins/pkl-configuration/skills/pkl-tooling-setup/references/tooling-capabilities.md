# Pkl Tooling Capabilities

Use this map to select a first-party tool boundary. Confirm flags and version
compatibility in the linked official documentation before automation.

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
- The first-party `pkl.pipe` package demonstrates text/JSON/YAML pipelines;
  package docs remain the authority for its current API.

See the [language reference](https://pkl-lang.org/main/current/language-reference/index.html)
and [first-party package index](https://pkl-lang.org/package-docs/).

## Tests and formatting

- `pkl format` is the canonical formatter.
- `pkl analyze imports` checks import topology; it does not replace evaluation.
- `pkl test` runs `pkl:test` facts and examples.
- Project tests belong in `PklProject.tests`; package API tests belong in
  `package.apiTests`.

The `pkl-engineering` skill's façade adds bounded TOON output and sandboxes test
and package-verification writes.

## Documentation, builds, and packages

| Need | First-party surface |
| --- | --- |
| API documentation | `pkldoc` and [apple/pkl-package-docs](https://github.com/apple/pkl-package-docs) |
| Gradle evaluation/docs/codegen | Pkl Gradle plugin in [apple/pkl](https://github.com/apple/pkl) |
| Bazel evaluation/tests/docs/codegen | [apple/rules_pkl](https://github.com/apple/rules_pkl) |
| Reusable package models | [apple/pkl-pantry](https://github.com/apple/pkl-pantry) |
| Kubernetes resource definitions | [apple/pkl-k8s](https://github.com/apple/pkl-k8s) |
| External readers | [apple/pkl-readers](https://github.com/apple/pkl-readers) |

## Bindings and code generation

The official Go and Swift bindings manage evaluator processes and expose
language-native values; JVM libraries integrate directly. Code generators turn
Pkl module types into host-language types when generated access is preferable
to dynamic decoding.

- [Language binding specification](https://pkl-lang.org/main/current/bindings-specification/index.html)
- [apple/pkl-go](https://github.com/apple/pkl-go)
- [apple/pkl-swift](https://github.com/apple/pkl-swift)
- [apple/pkl-jvm-examples](https://github.com/apple/pkl-jvm-examples)
- [apple/pkl-go-examples](https://github.com/apple/pkl-go-examples)
- [apple/pkl-swift-examples](https://github.com/apple/pkl-swift-examples)

Do not infer a binding API from another language. Each binding has its own
evaluator lifecycle, version matrix, and generated-code contract.
