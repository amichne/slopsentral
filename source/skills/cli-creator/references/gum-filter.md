# `gum filter` | Search a list

Use a filter when the caller remembers part of a name. Supply candidates as arguments or one per line on standard input. Typing narrows the list. Enter returns the selected candidate.

```sh
region=$(gum filter --placeholder 'Find a region' us-east us-west eu-west) || exit "$?"
[ -n "$region" ] || exit 1
printf '%s\n' "$region"
```

For a dynamic list, check the producer's status and handle an empty list before opening the filter. The [Git history recipe](gum.md#search-and-page-through-git-history) shows this pattern.
