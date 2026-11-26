# Source-linked example project

This project connects a greeting function to its executable evidence and OKF explanation.
It uses a portable documentation gate with explicit paths.
The gate needs Git, uv 0.12.9 or later, and Python 3.12 or 3.13.
No npm, mise, Slopsentral checkout, or OpenWiki runtime is necessary.

## Read and run the project

Read the [development procedure](handbook/development.md) for source review and focused behavior evidence.
The [knowledge index](knowledge/index.md) links the [greeting concept](knowledge/greeting.md).
The [coverage configuration](.knowledge/coverage.json) maps source to those documents.
The [review lock](.knowledge/review.lock.json) records the reviewed template bytes.

Run the example:

```sh
python3 app/greeting.py
python3 -m unittest discover -s app -p 'greeting_examples.py'
```

The application prints `Hello, reader.`.
The two assertions exercise a named reader and literal shell-like text.
They establish no external-host behavior.

## Examine documentation

Copy this complete project into an independent Git repository, including `.knowledge`.
Use the installed Code Knowledge Base runtime with its adjacent lock:

```sh
uv run --locked --script /absolute/path/to/code-knowledge-base/scripts/documentation.py check --repo /absolute/path/to/project --config .knowledge/coverage.json --lock .knowledge/review.lock.json
```

Replace both absolute paths with the actual runtime and project paths.
The unchanged template returns `CURRENT`.
The gate examines configured source coverage, active links, reachability, concept metadata, and reviewed fingerprints.
It needs no native Claims sidecars or OpenWiki checkpoint for this OKF store.

If source changes, review its explanation before a new snapshot.
Use the development procedure for `record` and its limits.
