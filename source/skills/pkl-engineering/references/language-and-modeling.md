# Pkl Language and Modeling

Use this reference while authoring or reviewing Pkl configuration contracts.
The façade proves operational behavior; these rules shape the Pkl program that
it evaluates.

## Configuration contracts

- Define reusable templates with typed properties, closed classes, type aliases,
  literal unions, and nested constraints. Prefer an invalid value failing during
  evaluation over a downstream consumer re-validating a primitive.
- Consume a schema module with `amends` when the consumer must retain the
  template's module type. Unknown members, misspellings, missing required
  properties, and failed constraints then surface as evaluation errors.
- Use `fixed` when a value must not be amended later. Use `const` when it must
  also be independent of non-constant state. Use abstract modules or classes for
  extension points that consumers must supply.
- Keep `Dynamic` at parsing, import, or interoperability boundaries. Convert it
  to a typed class with `toTyped` before treating its fields as trusted facts.
- Remember that Pkl type annotations and constraints are checked at runtime.
  `pkl analyze imports` proves syntax and import topology; evaluation proves the
  configuration contract.

## Expression and dynamism

- Use late-bound amendment for defaults that consumers can specialize while
  retaining the template's invariants.
- Prefer amendable `Listing` and `Mapping` in templates. Use eager `List` and
  `Map` for computed results that do not need later amendment.
- Use `for` and `when` generators, spreads, functions, glob imports, and glob
  reads for derived configuration. Keep the produced shape typed at the point
  where consumers rely on it.
- Pass external properties deliberately. Environment resources, direct remote
  imports, filesystem resources, and external readers are capabilities, not
  ambient conveniences.
- Separate `output.value` from `output.renderer`. Treat JSON, YAML, properties,
  plist, XML, textproto, PCF, and `pkl-binary` as consumer formats derived from
  one typed source model.

## Tests

- Test pure rules and constraints with `facts` in modules that amend `pkl:test`.
- Use `examples` for rendered or structured snapshots. A missing expectation can
  create an expected PCF file and a mismatch can create an actual PCF file, so
  use the façade's sandboxed `test run` for checks and `test update` only for an
  intentional reviewable snapshot change.
- Put project test entrypoints in `PklProject.tests`; pass modules explicitly for
  a narrower loop. Package API tests belong in `package.apiTests` and run during
  package verification/build.

## Source authority

This skill is a local operational synthesis, not a copy of Apple material. Use
the versioned official sources when language semantics matter:

- [Pkl 0.32 language reference](https://pkl-lang.org/main/0.32.0/language-reference/index.html)
- [`pkl:test` package docs](https://pkl-lang.org/package-docs/pkl/0.32.0/test/index.html)
- [Pkl style guide](https://pkl-lang.org/main/0.32.0/style-guide/index.html)
