# `gum input` | Collect one line

Use a short prompt for a name, identifier, or search term. A placeholder describes the expected input. Use `--value` when the person can accept or edit an existing value.

```sh
name=$(gum input --prompt 'Project name: ' --placeholder 'release-tools') || exit "$?"
[ -n "$name" ] || { printf '%s\n' 'Enter a project name.' >&2; exit 2; }
printf '%s\n' "$name"
```

Enter can submit an empty field. Apply the same validation as the command-line argument. For a secret, `--password` masks the screen only. Keep the value out of logs.
