# Schema Validation

Use this reference for repo-local hook validation.

## Schema Dependency

This repository owns the validation path used by hook metadata, runtime adapter
projections, hook sidecars, plugin composition, and marketplace entries. The
source graph validator checks hook references, executable paths, adapter command
shape, dependency references, and schema-linked hook requirement sidecars:

```sh
node source/tools/validate-source-graph.mjs
```

Adapter projections under `source/hooks/<adapter>/` must still parse as JSON and
point at existing executable hook implementations. The same source graph command
also checks local primitive references and rejects unsupported hook command
shape.

This is mandatory for every structured hook or plugin data change. If a new
structured hook artifact does not fit an existing schema, add or update the
owning schema before treating the artifact as accepted.

## Validation Checklist

- `source/hooks/<name>.hook.json` parses as JSON.
- Hook metadata is covered by `node source/tools/validate-source-graph.mjs`.
- Adapter projections under `source/hooks/codex/*.json` parse as JSON and call
  existing hook scripts through supported command runners.
- Every local `path` exists.
- Every `dependsOn` reference points at a canonical primitive.
- Hook sidecars such as `*.requirements.json` carry a `$schema` pointer under
  `source/schemas/` when they introduce their own structured data.
- Any plugin that composes the hook references it from `hooks/*` inside the
  `source/` graph, not from a plugin-local payload copy.
- Public-safe provenance is recorded when a hook is promoted from another
  source.

## Extra Checks

- Parse runtime adapter JSON with `python3 -m json.tool`.
- Run `bash -n` for shell hooks.
- Run `python3 -m py_compile` for Python hooks and remove any `__pycache__`
  artifacts before finishing.
- Run `node --check` for JavaScript hook implementations.
- Run a representative command for hooks that support local execution.
