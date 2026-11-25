# `gum file` | Pick a path

Start the browser in the directory that contains the expected files. Capture its output as one path. Quote it when the next command opens the file.

```sh
path=$(gum file --height 0 .) || exit "$?"
[ -f "$path" ] && [ -r "$path" ] || exit 1
wc -l < "$path"
```

The starting directory sets the initial view. A person can navigate to its parent. If the command restricts paths, enforce that rule after selection.
