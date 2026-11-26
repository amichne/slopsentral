# Change the greeting

Read [the greeting concept](../knowledge/greeting.md) before a behavior change.
Examine [the implementation](../app/greeting.py) and [its assertions](../app/greeting_examples.py).
The implementation owns the output. The concept explains it.

## Establish the result

Run the focused behavior procedure:

```sh
python3 -m unittest discover -s app -p 'greeting_examples.py'
```

After a source change, run the documentation gate:

```sh
uv run --locked --script /absolute/path/to/code-knowledge-base/scripts/documentation.py check --repo /absolute/path/to/project --config .knowledge/coverage.json --lock .knowledge/review.lock.json
```

`STALE` identifies changed source or page bytes.
A broken citation or missing concept metadata returns `REJECTED`.
A stale result cannot establish that the explanation is false.
Read the source diff and decide whether the explanation needs a change.

## Record the review

Refresh the affected explanation and its links when behavior changes.
If the explanation stays accurate, record the no-change reason in the existing PR or task receipt.
After that review, record the selected bytes:

```sh
uv run --locked --script /absolute/path/to/code-knowledge-base/scripts/documentation.py record --repo /absolute/path/to/project --config .knowledge/coverage.json --lock .knowledge/review.lock.json
uv run --locked --script /absolute/path/to/code-knowledge-base/scripts/documentation.py check --repo /absolute/path/to/project --config .knowledge/coverage.json --lock .knowledge/review.lock.json
```

Review the lock diff with the source and prose changes.
CI uses `check` only. It must not refresh the review snapshot.
A fingerprint records byte agreement. It does not prove semantic accuracy or reader comprehension.
Return to the [project entry point](../README.md) for the document map.
