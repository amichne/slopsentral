# Kotlin Horizontalization Heuristic

Use this at the end of a Kotlin turn to decide whether package/file layout is
becoming too flat. The automated check is advisory. File counts and names do
not prove a semantic defect or justify blocking completion.

## Terms

- **Package directory**: a directory under `src/main/kotlin`,
  `src/test/kotlin`, or an equivalent Kotlin source root.
- **Direct Kotlin file count**: `*.kt` files immediately in a directory, not
  recursive descendants.
- **Primary top-level member**: a top-level class, interface, object, enum,
  value class, data class, abstract class, or sealed root.
- **Prefix cluster**: three or more peer files whose file names share the same
  leading PascalCase token, such as `StandaloneRunner`,
  `StandaloneEnvironment`, and `StandalonePlan`.

## Directory Limits

Use direct file counts to choose directories for review.

| Condition | Result |
| --- | --- |
| 1 to 3 direct Kotlin files | Usually pass |
| 4 to 5 direct Kotlin files | Pass only when the package owns one semantic unit |
| 6 to 7 direct Kotlin files | Concern; require a named reason to stay flat |
| 8 or more direct Kotlin files | Concern; inspect generated or compatibility ownership |
| Module or feature root with more than 5 direct Kotlin files | Concern; inspect the documented ownership |

The root rule is stricter because root files become the visible vocabulary of a
module. A root should expose only the few concepts a reader must understand
first; implementation detail belongs under named subpackages.

## Choose a directory from the task

The hook splits each peer filename into PascalCase tokens. It removes `Default`,
`Base`, `Abstract`, `Internal`, `Impl`, `Test`, and `Spec` from each token list.
For example, `InternalInvoiceLine.kt` counts toward both `Invoice` and `Invoice Line`.
The hook reports three or more peers with the same first token or first two tokens left.

If a group covers at least half the directory, examine it first.
**Which task tells a reader to enter this directory, and which task lets them skip it?**

For example, `PublicJqEngine.kt`, `PublicJqProcess.kt`, and `PublicJqWorker.kt`
share the prefix `PublicJq`. The broader prefix `Public` also includes `PublicCliHelp.kt`. A `public/` directory sends a reader to
the same place for jq worker startup and shell help. Under `shell/`, a reader
can choose `jq/` for worker startup and skip it for shell help.

Try the proposed tree with a new task before you pick a filename. Can a
contributor place a new jq timeout policy from the names in `shell/` alone?
If another level adds no choice, keep the files together.

## File Ownership Rule

Default to one primary top-level member per file.

Allowed exceptions:

- A sealed root with its closed variants when they are one semantic unit.
- A small interface with library-owned implementations when callers experience
  them as one abstraction.
- A deliberately named package function file, such as `Parsing.kt`, when the
  functions are one vocabulary and no owning type would clarify the design.
- Generated files and compatibility shims when the reason is documented.

Flag a file when it contains multiple unrelated primary members, multiple
public owners, or a mix of domain model and transport/adapter code.

## Hook Decision

At turn end, inspect changed Kotlin files plus their package directories and
ancestors. The checker reports file-count and filename-prefix concerns and
exits 0 when inspection completes. Its JSON output has `status: advisory`;
`--summary` emits only the bounded finding count for the runtime adapter.
Operational errors remain failures, not successful inspections.

The checker does not infer top-level declarations from source text. Nested
classes, comments, string literals, sealed variants, and small library-owned
implementations cannot establish unrelated public owners through line regexes.
Inspect syntax and semantic ownership before suggesting a split. A real defect
requires a reachable behavior or contract problem beyond the layout heuristic.
