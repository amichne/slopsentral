---
name: "python-tooling"
description: "Create, change, or verify Python automation, portable uv scripts, setup tools, and process adapters. Use before choosing execution, dependencies, or command packaging. Explaining existing code alone does not require scaffolding or installation."
---

# Python Tooling

Write automation in Python. Prefer the standard library for small commands.
Pin uv in the project's `mise.toml`; use mise when installing that toolchain.
Give public commands executable names without file extensions. Put them on `PATH`.
Keep the `.py` suffix for Python modules.
Commit each portable uv script with its adjacent lockfile.
Run portable uv scripts with `uv run --locked --script`.

## Workflow

1. Inspect the existing automation owner, callers, toolchain, and checks.
   When that owner meets the task, extend it and preserve its execution contract.
   For explanation or verification alone, inspect or exercise the existing path
   without creating a project.
2. For a command change, name the legal inputs, outputs, and failures.
   Define one check for a valid input and one for the nearest invalid input.
3. When adding or changing a portable command, read
   [the standalone example](assets/standalone.py) and the
   [Python limits](references/boundaries.md) before choosing its execution model.
   Use PEP 723 to declare its Python range, direct dependencies, and index.
   Use `dependencies = []` for a standard-library script.
   Use `uv.toml` for project configuration.
4. Only when the task needs a new project and no existing owner meets its
   contract, run `scripts/python-scaffold --out PATH`.
   Review `mise.toml` before you run `mise install` from the new project.
   Run `mise exec -- automation-setup` to prepare the development environment and run its checks.
5. Use strict Pyright, Ruff, and pytest for the changed Python surface.
   Use the Pyright language server for source navigation when the host provides it.
   Use LibCST for edits that must preserve Python syntax and formatting.
6. Exercise the actual public command. For the scaffold's example, use
   `mise exec -- text-summary PATH`.
   Call the command from another directory after you put the project `bin` on `PATH`.
   Use an input path with spaces and shell metacharacters.
   Examine the exit status for a missing input.
   Pass subprocess arguments as a list.

## Completion

Report the checks and which host interfaces they exercised.
Keep the public command's runtime small. Keep development tools in the development environment.
Use a small launcher when the host needs one. Keep business logic and setup in Python.

When selecting indexes, preparing the development environment, or configuring
editor commands, read [the toolchain reference](references/toolchain.md).
