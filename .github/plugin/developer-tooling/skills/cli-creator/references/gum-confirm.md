# `gum confirm` | Approve an action

Name the action and its target in the question. Make refusal the default for a consequential action. Branch on the exit status.

```sh
target='weekly report'
gum confirm --default=false "Approve $target for export?" || exit "$?"
printf '%s\n' "$target"
```

Yes returns 0. No returns 1. An interruption also stops the example before it emits the target. Place the actual write after the guard. Keep unattended approval in an explicit flag.
