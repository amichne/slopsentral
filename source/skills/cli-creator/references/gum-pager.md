# `gum pager` | Read long output

Give the pager document contents on standard input. The positional argument is literal content. Arrow keys scroll the view and q closes it.

```sh
if [ -t 0 ] && [ -t 1 ]; then
  gum pager --show-line-numbers < README.md
else
  cat README.md
fi
```

Run this example in a directory with a README.md. When stdout feeds a file or pipeline, return the original bytes. Closing a pager only dismisses the view.
