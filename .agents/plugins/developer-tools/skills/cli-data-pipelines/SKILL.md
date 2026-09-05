---
name: cli-data-pipelines
description: "Use when searching local files, selecting code text, transforming JSON or YAML, or inspecting command output through bounded non-interactive CLI pipelines."
---

# CLI Data Pipelines

Choose commands by input and output contracts. Prefer available tools over
installing a preferred toolbox. Semantic symbol identity requires a compiler or
semantic index; text matches only establish textual evidence.

## Workflow

1. State the question, allowed roots, required fields, and output bound. Inspect
   available commands and their versions before relying on implementation-specific
   flags, especially for tools named `yq`.
2. Use `rg` or `git grep` for scoped text, `fd` or `find` for paths, and `jq` or a
   small parser for JSON. Keep structured data structured across command boundaries.
3. Pass patterns and values as arguments, not executable shell text. Preserve
   filenames with NUL-delimited records where commands exchange paths.
4. Bound discovery at its source where possible. Record truncation or pagination;
   a limited sample cannot establish repository-wide absence.
5. Distinguish an empty result from a command error. Keep diagnostic output on
   stderr and parseable results on stdout. Disable pagers and terminal decoration.
6. Preview candidate files before any bulk mutation. Use a tested script once
   quoting, branching, or state makes a pipeline difficult to review.

## References

Read [pipeline contracts](references/pipeline-contracts.md) for executable patterns
and exit-status handling. Interactive `fzf`, previews, and directory-jump tools
belong in a human shell session, not an unattended agent command.

## Completion Criteria

The result answers the scoped question with source paths and explicit limits.
Input values cannot become commands, errors cannot masquerade as empty results,
and no unrelated file or tool installation changes.

Read [provenance](references/provenance.md) when updating this skill.
