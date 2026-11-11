---
name: "python-tooling"
description: Build, refactor, and verify typed Python automation, self-contained uv scripts, setup tools, and process adapters with PEP 723, strict Pyright, Ruff, and pytest. Use when replacing shell pipelines or authoring reusable command-line tooling.
---

# Python Tooling

Write automation in Python. Prefer the standard library for small commands.
Install uv through mise. Pin uv in the project's `mise.toml`.
Give public commands executable names without file extensions. Put them on `PATH`.
Keep the `.py` suffix for Python modules.
Keep Python dependency lockfiles out of Git.

## Workflow

1. Name the legal inputs, outputs, and failures. Define one check for a valid input and one for the nearest invalid input.
2. Use [the standalone example](assets/standalone.py) for a small portable command.
   Use PEP 723 to declare its Python range, direct dependencies, and index.
   Use `uv.toml` for project configuration.
   Read [the Python limits](references/boundaries.md) for enforcement details.
3. Run `scripts/python-scaffold --out PATH` to create a development project.
   Review `mise.toml` before you run `mise install` from the new project.
   Run `mise exec -- automation-setup` to prepare the development environment and run its checks.
4. Use strict Pyright, Ruff, and pytest.
   Use the Pyright language server for source navigation when the host provides it.
   Use LibCST for edits that must preserve Python syntax and formatting.
5. Run `mise exec -- text-summary PATH` to try the public command.
   Call the command from another directory after you put the project `bin` on `PATH`.
   Use an input path with spaces and shell metacharacters.
   Examine the exit status for a missing input.
   Pass subprocess arguments as a list.

## Completion

Report the checks and which host interfaces they exercised.
Keep the public command's runtime small. Keep development tools in the development environment.
Use a small launcher when the host needs one. Keep business logic and setup in Python.

Read [the toolchain reference](references/toolchain.md) for index settings, setup, and editor commands.
