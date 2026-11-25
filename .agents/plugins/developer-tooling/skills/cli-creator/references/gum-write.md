# `gum write` | Edit several lines

Use a text area for a description or handoff. In Gum 2.0.2, Ctrl-J inserts a line break. Enter submits the text on stdout.

```sh
details=$(gum write --header 'Describe the change' --height 6) || exit "$?"
printf '%s\n' "$details"
```

Quote the result to preserve internal line breaks. Shell command substitution strips final newlines. When those bytes matter, capture output in a temporary file and check success before using it.
