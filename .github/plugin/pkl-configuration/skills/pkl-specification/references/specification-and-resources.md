# Pkl Specification and Resource Definition

Use this reference to make the configuration boundary explicit before
implementation.

## Specification inventory

Record these facts:

| Concern | Required evidence |
| --- | --- |
| Consumer | Process, library, build task, or deployment system reading output |
| Entry module | Module evaluated directly by a command or binding |
| Template | Module or class amended/extended by consumers |
| Invariants | Required members, legal variants, ranges, relationships, and fixed values |
| Inputs | Imported modules, resources, properties, environment, packages, or readers |
| Outputs | Value shape, renderer, file pattern, and owning downstream consumer |
| Proof | Evaluation roots, facts, examples, package API tests, and checked artifacts |

Use `amends` when consumers must retain the template's module type and reject
unknown members. Use a class or type alias when a reusable value has its own
identity or constraints. Use tests for relationships that cannot be fully
expressed as a property type.

## Modules versus resources

Modules are executable Pkl programs loaded by import or evaluation. Resources
are bytes/text loaded with `read`, `read?`, or `read*`. Do not blur the two:
module code can define contracts and derived values; resources are external
inputs that need parsing and type conversion.

Official module URI families include local file, HTTPS, module path, standard
library, package assets, project-package dependencies, and relative/dependency
notation. Resource schemes include file, environment, properties, package
assets, project-package assets, and registered external readers. The exact
allowlist is an evaluator capability and should be explicit.

See the version-matched
[language reference](https://pkl-lang.org/main/current/language-reference/index.html)
and [CLI common options](https://pkl-lang.org/main/current/pkl-cli/index.html).

## Typed ingestion

1. Read or import the external representation at one boundary.
2. Parse JSON, YAML, or other structured content into its dynamic model.
3. Convert to a typed class with `toTyped` or a purpose-built constructor.
4. Reject unknown, absent, or constrained values during evaluation.
5. Pass only typed values downstream.

Prefer package dependencies with checksums and a resolved
`PklProject.deps.json` over floating HTTPS imports. An external reader executes
host code and deserves the same trust review as any other executable tool.

## Output definition

Specify one typed `output.value` and derive consumer formats with a renderer.
Use `output.files` only when a single evaluated model owns multiple files. Keep
output paths inside an explicit root and review custom converters because they
can change semantic representation.

Built-in renderers cover JSON, Jsonnet, PCF, plist, properties, protobuf
text format, XML, and YAML. First-party packages add other formats and
transformations; verify their versioned APIs in the
[package index](https://pkl-lang.org/package-docs/).

## Security questions

- Can evaluation read outside the workspace?
- Which environment names and external properties are visible?
- Are HTTPS imports or resources allowed, and are versions/checksums fixed?
- Does any external reader or `pkl:Command` run host code or write files?
- Can project evaluator settings silently widen a command's capabilities?
- Are secrets exposed through process arguments, logs, or rendered output?

Default to denial and add narrow capabilities only when the specification names
their consumer and proof.
