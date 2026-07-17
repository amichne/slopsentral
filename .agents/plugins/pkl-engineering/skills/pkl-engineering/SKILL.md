---
name: pkl-engineering
description: Pkl engineering for typed configuration contracts, expressions, amendments, evaluation, formatting, tests, projects, dependencies, rendering, and packages. Use when a repository contains `.pkl` modules or `PklProject`, or when configuration behavior should be modeled and enforced with Apple Pkl.
---

# Pkl Engineering

Treat Pkl as an evaluated configuration contract. Put invariants in Pkl types,
constraints, and amendment boundaries; then prove them by evaluating the real
entry modules and running their tests.

Apply `concepts/type-safety/core.md` as the shared semantic-design authority
when it is available. This skill owns Pkl-specific realization through closed
classes, literal unions, constrained aliases, typed amendments, evaluation, and
explicit evaluator capabilities; it does not redefine the cross-language rules.

## Start From Live State

Resolve this skill directory, then use its façade rather than rebuilding Pkl
commands from prose:

```sh
<skill-dir>/scripts/pkl_agent --workspace <repo>
<skill-dir>/scripts/pkl_agent --workspace <repo> doctor
```

The no-argument view reports the executable, Pkl version, project and lock
presence, module/test counts, active evaluator policy, and useful next commands.
Stop on `missing` or `unsupported`; this façade supports Pkl `>=0.32.0,<0.33.0`.

## Work the Contract

1. Identify the configuration entry modules, their templates, consumers, and
   external inputs. Do not assume every `.pkl` file is directly evaluable.
2. Encode required values and legal ranges in typed classes, type aliases, and
   constraints. Use `amends` when a consumer must retain a template's module
   type and reject unknown members.
3. Keep dynamic input at a boundary. Convert `Dynamic` data to typed values
   before downstream use, and allow environment or remote inputs explicitly.
4. Run the narrowest façade operation that proves the change, then widen to
   formatting, entry-module validation, project tests, and package verification
   when those surfaces are affected.
5. Report exact commands, exit status, evaluated modules, test aggregates, and
   written artifacts. Evaluation is the enforcement gate; formatting and import
   analysis are not substitutes for it.

Read [language-and-modeling.md](references/language-and-modeling.md) when
authoring schemas, constraints, amendments, generators, renderers, or tests.

Read [projects-security-and-interop.md](references/projects-security-and-interop.md)
when working with `PklProject`, dependencies, packages, environment/resources,
bindings, code generation, `pkl run`, or editor integrations.

## Use the Façade

```sh
# Non-mutating development loop
<skill-dir>/scripts/pkl_agent --workspace <repo> format check --all
<skill-dir>/scripts/pkl_agent --workspace <repo> imports <module>...
<skill-dir>/scripts/pkl_agent --workspace <repo> module validate <module>...
<skill-dir>/scripts/pkl_agent --workspace <repo> module inspect <module> --expression '<expression>'
<skill-dir>/scripts/pkl_agent --workspace <repo> test run [<test-module>...]
<skill-dir>/scripts/pkl_agent --workspace <repo> package verify [<project-dir>...]

# Explicit writes
<skill-dir>/scripts/pkl_agent --workspace <repo> format apply --all
<skill-dir>/scripts/pkl_agent --workspace <repo> module render <module> --format json --out <path>
<skill-dir>/scripts/pkl_agent --workspace <repo> test update [<test-module>...]
<skill-dir>/scripts/pkl_agent --workspace <repo> project resolve [<project-dir>...]
<skill-dir>/scripts/pkl_agent --workspace <repo> package fetch <package-uri>...
<skill-dir>/scripts/pkl_agent --workspace <repo> package build --out '<path-pattern>' [<project-dir>...]
```

Every command emits TOON on stdout. Diagnostics and large evaluated values are
bounded; use `--full` only when the preview is insufficient. Use `--fields`
where a list command offers additional columns. Exit `0` means success or an
idempotent no-op, `1` means the requested operation failed, and `2` means the
invocation was invalid.

The default `agent-safe` policy confines file access to the workspace, excludes
ambient environment resources and direct HTTPS module imports. Evaluation,
test, import, and download commands omit project evaluator settings; project
commands receive explicit root and allowlist flags so settings cannot widen
those boundaries. Add narrow
exceptions with `--allow-env`, `--property`, `--allow-module`, or
`--allow-resource`. Use `--policy project` only after inspecting and accepting
the repository's evaluator settings.

`test run` and `package verify` copy the workspace to a temporary sandbox so
snapshot or package side effects do not alter source. Mutating counterparts are
named explicitly. Arbitrary `pkl run`, external readers, publishing, LSP,
documentation generation, and language code generation remain advanced native
Pkl boundaries rather than hidden façade behavior.

## Completion Criteria

- Every changed Pkl entry module evaluates successfully under the declared
  policy, or the remaining failure is reported with its source location.
- Focused tests pass without unreviewed snapshot writes; intentional snapshot
  updates are explicit and reviewed.
- Formatting, dependency-lock, rendered-output, and package claims cite the
  corresponding façade result.
- No secret, environment resource, remote module, external reader, command
  write, or package publication capability is enabled implicitly.
