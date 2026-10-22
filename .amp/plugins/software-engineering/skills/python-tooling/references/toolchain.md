# Reproducible toolchain

Require uv before setup. Declare Python in `.python-version` and `requires-python`.
Use `tool.uv.package = false` for automation that is not a distributable package;
`tool.uv.no-build = true` forbids source builds of dependencies. These are separate
settings. A missing wheel is a setup failure, not permission to disable no-build.
Declare indexes explicitly, use first-index resolution, and scope private indexes
to named packages. Never put credentials in metadata or lockfiles.

PEP 723 scripts declare their own dependencies; they do not inherit a project's
dependencies or tool configuration. Commit adjacent script locks. Development
checks use the accompanying pyproject. The template's self-test deliberately
uses the script environment. The scaffold adds both lockfiles during setup.

Editor: select `.venv/bin/python` (Windows `.venv/Scripts/python.exe`). Start
`uv run --locked pyright-langserver --stdio` for Pyright LSP and
`uv run --locked ruff server` for Ruff. Pyright's CLI is the static gate, not an
LSP session. Host LSP or typed symbol tools can supply semantic references; if
unavailable, name that limitation and validate a bounded LibCST refactor with
strict checking and independent tests. Do not advertise a nonexistent TSP API.

The declared pyright nodejs extra provides the Node runtime through uv; project
JavaScript and Pkl tools remain separately owned capabilities. Use LibCST from
the refactor dependency group with `uv sync --locked --group refactor`.

Sources: [uv scripts](https://docs.astral.sh/uv/guides/scripts/),
[uv settings](https://docs.astral.sh/uv/reference/settings/),
[Pyright configuration](https://github.com/microsoft/pyright/blob/main/docs/configuration.md),
[Ruff configuration](https://docs.astral.sh/ruff/configuration/),
[pytest good practices](https://docs.pytest.org/en/stable/explanation/goodpractices.html),
[LibCST](https://libcst.readthedocs.io/en/latest/).
