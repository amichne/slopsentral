# Gum prompts

Use Charm's `gum` executable when a shell interface needs a prompt. Keep argument parsing and the underlying operation in the existing command. Both interactive and unattended callers must be able to supply the same values.

| What the person needs to do | Gum command |
| --- | --- |
| Pick from a short list | `gum choose` |
| Search a longer list | `gum filter` |
| Enter one line or several lines | `gum input` or `gum write` |
| Approve an action | `gum confirm` |

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

Capture the selected value on stdout. Pass it to the operation as one quoted argument. For a CLI with a machine-output mode, bypass prompts when that mode is active, even in a terminal.

## Confirm a write

Name the target in the prompt. Use the exit status of `gum confirm` to decide whether to write. For example, `gum confirm --default=false "Overwrite $target?" || exit "$?"` stops the script on refusal or interruption. Place the write after this guard. Keep unattended approval in the command's existing flags.

Exercise the picker with Enter and Ctrl-C. Make sure that cancellation prevents the operation. Run the explicit argument path with standard input disconnected and Gum absent. Compare captured stdout with the documented result.

For installation options and command examples, see [Charm's Gum documentation](https://github.com/charmbracelet/gum#readme). Use `gum <command> --help` for the flags in the installed version.
