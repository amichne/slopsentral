---
name: python-tooling
description: Build, refactor, and verify typed Python automation, self-contained uv scripts, setup tools, and process adapters with PEP 723, strict Pyright, Ruff, and pytest. Use when replacing shell pipelines or authoring reusable command-line tooling.
---

# Python Tooling

Make automation a typed program with a small effect boundary. uv is required;
there is no ambient pip, virtualenv activation, shell framework, or silent
fallback. Keep existing non-Python compilers at their explicit process boundary.

## Workflow

1. Name the input invariants, legal outputs, finite failures, effects, and
   independently specified success and rejection checks. Apply Semantic Ratchet
   for API ownership and failure-preserving composition.
2. Use a uv project for a multi-module tool. For a portable script, start from
   [standalone.py](assets/standalone.py): PEP 723 dependencies, Python requirement,
   named index, no-build, pure decisions, typed outcomes, and `--self-test`.
   Read [boundaries](references/boundaries.md) for the Python enforcement limits.
3. For a new directory, run `uv run --locked --script scripts/scaffold.py --out PATH` from
   this skill directory. It copies the authored template and check configuration
   without overwriting an existing directory. Run `uv run --locked --script setup.py` inside the new directory to create
   project and script locks, install declared tools, and run every gate. Review
   and commit both locks. Setup and dependency refresh are explicit effects.
4. Use Pyright's LSP with the uv environment for definitions, references, rename,
   and diagnostics when the host supports it. Verify the advertised capability
   before a refactor; Pyright is not a general codemod engine. Inspect all callers,
   then use LibCST for syntax-preserving transformations when semantic rename is
   unavailable or insufficient. Run strict Pyright before and after the edit.
5. Run `uv run --locked ruff format --check .`, `uv run --locked ruff check .`,
   `uv run --locked pyright`, and `uv run --locked pytest`. Also run
   `uv run --locked --script standalone.py --self-test` to prove script isolation.
   Zero tests, stale locks, missing tools, and unexpected diagnostics fail the gate.
6. Verify the real CLI with literal arguments containing spaces and metacharacters,
   missing inputs, dependency failure, and an independent expected result.
   Use argument arrays and `shell=False`; preserve exit codes and cancellation.
   Keep cleanup in context managers and avoid text scraping when structured data
   is available. A rejected precondition must not invoke downstream effects.

## Completion

Commit source and locks together when committing is in scope. Report what static
checks prove, what runtime checks prove, and which external integrations remain
unverified. Do not suppress errors to create a green result. A required host
launcher may invoke uv directly; business logic and setup remain in Python.

Read [toolchain](references/toolchain.md) for indexes, setup, editor commands,
refactoring, and upstream documentation. Assets are local authored examples.
