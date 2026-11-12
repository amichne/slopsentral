# Python toolchain

Pin uv in `mise.toml`. Use `mise install` to install the selected version.
Declare Python in `.python-version` and `requires-python`.
Put shared uv settings in `uv.toml`. Set `no-build = true` to forbid source builds of dependencies.
Declare package indexes explicitly. Use `first-index` resolution.
Scope private indexes to their named packages.

## Enterprise package indexes

Set `UV_CONFIG_FILE` to a company uv configuration file.
Set `UV_DEFAULT_INDEX` to replace the default index for one command.
Use `UV_INDEX` to add an index with higher priority.
Use a named index for credentials. Supply its `UV_INDEX_<NAME>_USERNAME` and `UV_INDEX_<NAME>_PASSWORD` from your secret store.

Set `UV_SYSTEM_CERTS=true` if the operating system trusts the company CA.
For a PEM bundle, set `SSL_CERT_FILE` to its path.
The bundle replaces uv's default trust roots.
Keep credentials outside the index URL and configuration file.

## Command runtime

Use the standard library when it meets the command's needs.
For a portable script, declare the Python range and direct dependencies in its PEP 723 header.
Use `uv run --script PATH` for script execution.
The script's metadata supplies its dependencies and index settings.
Give the public executable a name without an extension.
Keep Python dependency lockfiles out of Git.
If uv creates a development lockfile, ignore it.

## Development

Use `uv sync` to prepare the development environment.
Select `.venv/bin/python` in the editor on POSIX. On Windows, select `.venv/Scripts/python.exe`.
Start `uv run pyright-langserver --stdio` for Pyright LSP.
Start `uv run ruff server` for Ruff.
If the host lacks the language server, use the Pyright CLI and a focused test.
Use `uv sync --group refactor` to install LibCST for a syntax-preserving edit.

The `pyright[nodejs]` dependency supplies Node.js through uv.
Project JavaScript and Pkl tools use their own toolchains.

[uv scripts](https://docs.astral.sh/uv/guides/scripts/), [uv settings](https://docs.astral.sh/uv/reference/settings/), [Pyright configuration](https://github.com/microsoft/pyright/blob/main/docs/configuration.md), [pytest practices](https://docs.pytest.org/en/stable/explanation/goodpractices.html), [LibCST](https://libcst.readthedocs.io/en/latest/)
