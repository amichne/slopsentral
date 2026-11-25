# `gum log` | Emit a diagnostic

Use levels for severity and key/value pairs for details. Direct diagnostics to stderr so a caller can redirect the command's result independently.

```sh
gum log --level warn --structured 'Skipped empty report' report weekly >&2
```

With `--structured`, pass the message first, then alternating keys and values. Logging an error describes a failure. Return a nonzero status from the command that failed.
