# `gum version-check` | Check Gum compatibility

Use a quoted semantic version constraint when a feature needs a known release range. The shell can use the status directly. `gum --version` prints the installed version for a person.

```sh
gum version-check '>= 2.0.0, < 3.0.0' || exit "$?"
```

This example checks for the 2.x series. Select a range from the features your command uses. Check it only on paths that invoke Gum. An incompatible version or invalid constraint returns nonzero.
