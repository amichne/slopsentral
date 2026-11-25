# `gum format` | Render a document

Use `--type markdown` for help or a review preview. Gum accepts text arguments or a document on standard input. It prints the rendered result.

```sh
printf '%s\n' '# Review' '- Confirm the owner' '- Check the due date' |
  gum format --type markdown
```

Use `--type code --language sh` for a shell excerpt, `emoji` for named emoji, or `template` for a template you control. Keep the source document for export.
