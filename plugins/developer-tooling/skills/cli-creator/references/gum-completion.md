# `gum completion` | Generate shell completions

Use this packaging command to generate completions for Gum itself. The shell name selects the output syntax. Each invocation writes the generated script to stdout.

```sh
gum completion bash > gum.bash || exit "$?"
gum completion zsh > _gum || exit "$?"
gum completion fish > gum.fish || exit "$?"
```

Run these commands in an empty staging directory. Install the selected file through the package's existing shell integration. For a wrapper with different flags, generate its completions from its own command definitions.
