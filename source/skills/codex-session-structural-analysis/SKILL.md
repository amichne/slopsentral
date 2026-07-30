---
name: "codex-session-structural-analysis"
description: "Analyze a Codex JSONL session and its recursively spawned descendants with jq. Use to project the session tree, join tool calls to outputs, profile matching command families, count compactions or failures, inspect token ledgers, or build reusable structural JSON projections; not for repository call graphs or Kotlin and Gradle symbol relationships."
---

# Codex Session Structural Analysis

Work from one explicit root JSONL file and one bounded sessions directory.
Session ledgers can contain prompts, tool output, paths, credentials, and other
sensitive material; keep derived artifacts local and project only needed fields.

## Workflow

1. Identify the exact root session by thread ID or known file path. Do not scan
   every historical ledger when a bounded date or task directory is available.
2. Probe record shapes and event-type counts before writing a selector.
3. Use `scripts/codex_session_tree` to walk `sub_agent_activity` descendants,
   fail on missing or ambiguous child files, and join calls to outputs. For
   incomplete historical archives, add `--allow-missing` and retain stderr as
   the partial-evidence ledger.
4. Filter the emitted JSONL by structured fields. Use
   `scripts/tool_call_profile.jq` only when textual command-family matching is
   the intended boundary.
5. Report session count, missing evidence, sample count, and the exact
   projection. Do not turn absence in an incomplete tree into a zero.

## Commands

```bash
SESSION_TOOL="source/skills/codex-session-structural-analysis/scripts/codex_session_tree"
PROFILE_FILTER="source/skills/codex-session-structural-analysis/scripts/tool_call_profile.jq"
SESSION_ARTIFACT_DIR="$(
  mktemp -d "${TMPDIR:-/tmp}/codex-session-analysis.XXXXXX"
)"

"$SESSION_TOOL" files --root "$ROOT_SESSION" --sessions-dir "$SESSIONS_DIR"
"$SESSION_TOOL" calls --root "$ROOT_SESSION" --sessions-dir "$SESSIONS_DIR" \
  > "$SESSION_ARTIFACT_DIR/calls.jsonl"
jq -s --arg pattern 'kast .*graph|kast .*symbol' \
  -f "$PROFILE_FILTER" "$SESSION_ARTIFACT_DIR/calls.jsonl"
```

The tool also supports `events`, which wraps every raw record with its session
ID, parent, depth, and source file.

## Boundaries

- Use Kast for Kotlin or Gradle callers, callees, hierarchy, graph, and impact.
- Use Graphify for persistent non-Kotlin repository knowledge.
- Do not publish raw ledgers or broad extracts without explicit review.
- Do not parse human prose when a typed record field exists.

## Reference Routing

Read [jq-building-blocks.md](references/jq-building-blocks.md) for shape probes,
call/output joins, descendants, token snapshots, compactions, failures, and
general structural projections.

## Completion Criteria

- The root and bounded sessions directory are explicit.
- Every discovered child is resolved exactly once or reported missing.
- Calls are joined by `call_id`; timing summaries disclose their filter and
  sample count.
- Sensitive raw content remains local and excluded from the reported result.
