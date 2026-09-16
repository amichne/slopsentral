# Pipeline Contracts

For JSON, bind an external value instead of interpolating it into a filter:

```bash
jq --arg wanted "$name" '.items[] | select(.name == $wanted)' input.json
```

For tracked paths, preserve delimiters and inspect the set before mutation:

```bash
git ls-files -z -- '*.kt' > candidates.paths
```

A consumer must also support NUL delimiters. Quoting an entire newline-delimited
list does not recover filenames containing newlines. Do not parse `ls` output.

Ripgrep emits several record types in JSON mode; select match records explicitly.
Its status 1 means no match, while other nonzero statuses can indicate errors.
Capture and classify the producer status before a successful consumer masks it.
Under `set -e`, put expected nonzero results in an explicit conditional. Under
`pipefail`, account for SIGPIPE when a downstream limit exits early.

A `head` limit hides remaining matches. Report the limit or fetch the necessary
next page; do not interpret truncation as proof of completeness. A broad text
replacement cannot prove that it preserved symbol identity.

Prefer `bat --paging=never --color=never` for an unattended highlighted reader
only when installed; a bounded ordinary file read is sufficient. Use `curl` or
an available HTTP client according to the actual API contract, not appearance.
Do not expose credentials in debug output or shell history.
