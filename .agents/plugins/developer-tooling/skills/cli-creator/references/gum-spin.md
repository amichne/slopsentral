# `gum spin` | Show progress while a command runs

Pass the executable and its arguments after `--`. Use a spinner for work with an unknown duration. Let the child command determine success.

```sh
gum spin --title 'Checking the working tree' --show-error -- git diff --check >&2 || exit "$?"
printf '%s\n' 'Working tree check passed.'
```

Run this inside a Git checkout. Gum normally hides child output. `--show-error` exposes the child's output on failure. The redirection keeps it on stderr. When stdout is an API, run the child directly.
