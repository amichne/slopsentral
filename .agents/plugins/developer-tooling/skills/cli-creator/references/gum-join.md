# `gum join` | Arrange text blocks

Use `--vertical` for narrow terminals and `--horizontal` when both blocks fit. Pass each complete block as one argument.

```sh
label=$(gum style --bold 'Queue') || exit "$?"
counts=$(printf 'Ready: 4\nWaiting: 2')
gum join --vertical -- "$label" "$counts"
```

Quoting preserves the lines within each block. Use `--align` to align blocks of unequal size. Save the underlying counts for callers that consume structured data.
