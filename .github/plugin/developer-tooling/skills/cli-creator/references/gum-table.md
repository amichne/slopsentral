# `gum table` | Inspect records or select a row

Use a table when the decision depends on several fields. Gum reads CSV from standard input or `--file`. Without `--columns`, the first record supplies the headings.

```sh
id=$(gum table --height 6 --return-column 1 <<'CSV'
ID,Owner,State
R17,Design,ready
R24,Support,queued
CSV
) || exit "$?"
case "$id" in
  R17|R24) printf '%s\n' "$id" ;;
  *) exit 2 ;;
esac
```

`--return-column` counts from 1. Use a plain identifier column for dispatch. A quoted CSV field needs a CSV reader. For a display with no selection, use `--print`. If the interactive view shows only headings and a count, print the table and offer its IDs with [choose](gum-choose.md).
