# `gum choose` | Pick from a short menu

Use a menu when a person can recognize every option at a glance. Pass each value as a separate argument. Enter returns the highlighted value on stdout.

```sh
view=$(gum choose --header 'Report view' summary details) || exit "$?"
case "$view" in
  summary|details) printf '%s\n' "$view" ;;
  *) exit 2 ;;
esac
```

For several choices, set `--limit` to the maximum count. Read the output one record at a time so spaces inside a choice survive.
