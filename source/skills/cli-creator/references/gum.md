# Gum command guides and terminal recipes

For an individual element, use the [command inventory](#command-inventory). For a complete flow, choose a recipe below. Keep prompts and progress on the interactive path. When the caller requests machine output, bypass the terminal UI even if a terminal is available.

| Terminal flow | Recipe |
| --- | --- |
| Offer a menu but support pipelines | [Accept a value from an argument or a picker](#accept-a-value-from-an-argument-or-a-picker) |
| Compose a handoff and approve its contents | [Draft a handoff note](#draft-a-handoff-note) |
| Find a branch and inspect its history | [Search and page through Git history](#search-and-page-through-git-history) |
| Show progress and preserve failure status | [Check a Git repository](#check-a-git-repository) |
| Inspect a CSV export as a table | [Preview an inventory file](#preview-an-inventory-file) |

## Accept a value from an argument or a picker

This shell command prints one report format. An explicit argument works in a pipeline, even if Gum is absent.

```sh
case $# in
  1) format=$1 ;;
  0)
    if ! [ -t 0 ] || ! [ -t 2 ]; then
      printf '%s\n' 'Pass a report format: text or json.' >&2
      exit 2
    fi
    if ! command -v gum >/dev/null 2>&1; then
      printf '%s\n' 'Pass text or json, or install Gum for the picker.' >&2
      exit 1
    fi
    format=$(gum choose --header 'Report format' text json) || exit "$?"
    ;;
  *) printf '%s\n' 'Usage: report-format [text|json]' >&2; exit 2 ;;
esac

case "$format" in
  text|json) printf '%s\n' "$format" ;;
  *) printf '%s\n' 'Expected text or json.' >&2; exit 2 ;;
esac
```

Capture the selected value on stdout. Pass it to the operation as one quoted argument.

## Draft a handoff note

Run this in a terminal. Enter submits the title. In the body, Ctrl-J adds a line and Enter submits the text. The preview goes to stderr. Only an approved note reaches stdout.

```sh
title=$(gum input --prompt 'Title: ') || exit "$?"
[ -n "$title" ] || { printf '%s\n' 'A title is required.' >&2; exit 2; }
body=$(gum write --header 'Handoff details') || exit "$?"
note=$(printf '# %s\n\n%s' "$title" "$body")
printf '%s\n' "$note" | gum format --type markdown >&2 || exit "$?"
gum confirm --default=false 'Return this handoff note?' || exit "$?"
printf '%s\n' "$note"
```

If the caller saves the note, open the destination after approval. Shell redirection opens a destination before the script starts.

## Search and page through Git history

Run this in a terminal inside a Git repository with local branches. The filter searches branch names. The pager displays the chosen branch's commits. Press q to return.

```sh
branches=$(git for-each-ref --format='%(refname:strip=2)' refs/heads/) || exit "$?"
[ -n "$branches" ] || { printf '%s\n' 'No local branches.' >&2; exit 0; }
branch=$(printf '%s\n' "$branches" | gum filter --placeholder 'Find a branch') || exit "$?"
[ -n "$branch" ] || exit 1
history=$(git log -30 --oneline "refs/heads/$branch" --) || exit "$?"
printf '%s\n' "$history" | gum pager
```

## Check a Git repository

Run the same integrity check from a terminal or a job. The interactive path shows a spinner and a completion message. The job receives Git's ordinary diagnostics and exit status.

```sh
if [ -t 1 ] && [ -t 2 ] && command -v gum >/dev/null 2>&1; then
  gum spin --show-error --title 'Checking Git objects' -- git fsck --connectivity-only >&2 || exit "$?"
  gum log --level info 'Git object check passed' >&2
else
  git fsck --connectivity-only
fi
```

## Preview an inventory file

In a terminal, pick a CSV file with a header row. This preview labels the file and prints its rows. For a pipeline, accept a path argument and send the original CSV to stdout.

```sh
printf '%s\n' 'Pick an inventory CSV' >&2
path=$(gum file --height 0 .) || exit "$?"
heading=$(gum style --bold 'Inventory') || exit "$?"
gum join --vertical -- "$heading" "$path" || exit "$?"
gum table --print --file "$path"
```

## Command inventory

Gum 2.0.2 lists 14 commands in `gum --help`. It also provides two packaging commands, `completion` and `man`. For the options in your installed version, use `gum <command> --help`. [Charm’s command definitions](https://github.com/charmbracelet/gum/blob/v2.0.2/gum.go) and [Gum documentation](https://github.com/charmbracelet/gum#readme).

- To select a value, use [choose](gum-choose.md) for a short menu, [filter](gum-filter.md) for search, [file](gum-file.md) for a path, or [table](gum-table.md) for rows with several fields.
- To collect text, use [input](gum-input.md) for one line or [write](gum-write.md) for several. To ask permission for an action, use [confirm](gum-confirm.md).
- To present results, use [format](gum-format.md) for Markdown or code, [style](gum-style.md) for a labeled block, [join](gum-join.md) for layout, or [pager](gum-pager.md) for long output.
- To report work, use [spin](gum-spin.md) while a command runs or [log](gum-log.md) for persistent diagnostics.
- To check compatibility, use [version-check](gum-version-check.md). To package Gum's shell completions or manual, use [completion](gum-completion.md) or [man](gum-man.md).
