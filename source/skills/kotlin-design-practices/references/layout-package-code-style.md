# Layout, Package, And Code Style

Use this when a Kotlin change needs package layout, file layout, naming, or
expression-style decisions.

## Package Layout

- A package is a semantic boundary, not a folder for a technical concern. Name it
  for the domain unit it owns.
- Avoid broad packages such as `common`, `utils`, `helpers`, `support`, or
  `internal` unless the repository already gives them a precise meaning.
- Let the package remove prefixes from type names. `workspace.Parser` is usually
  clearer than `workspace.WorkspaceParser`.
- Move code closer to the behavior it serves before creating shared packages.
  Shared code should earn its place by serving multiple stable owners.
- Prefer vertical feature/domain grouping over cross-cutting slices such as
  `validators`, `mappers`, or `extensions`.
- Consult the [directory heuristic](horizontalization-heuristic.md) for six or more direct Kotlin files
  or three peers with a shared prefix. Use it to decide which child a reader can enter or skip.

## File Layout

- One file should usually center on one public interface, class, value class, or
  sealed root.
- Keep a sealed hierarchy in one file by default. Its variants are part of the
  closed semantic unit unless they become large independent subsystems.
- Keep an interface and its small library-owned implementations together when
  callers understand them as one abstraction.
- Companion factories, parsers, and tightly-owned extensions may live beside the
  type they construct or enrich.
- Split a file only when the extracted file has a name that describes a real
  unit: a boundary adapter, policy, parser, renderer, transport, or workflow.
- Do not split because of extensions alone. A single owning file may contain
  the type, companion factories, and directly related extensions.

## Naming

- Name packages and types from the reader's point of view at the call site.
- Omit visibility modifiers from directory, file, and declaration names when they
  only describe access. In `shell/jq/`, `JqWorker` still identifies the worker
  at a call site. `PublicJqWorker` adds no detail about its job.
- Keep visibility words that describe the domain. `PublicKey` names a kind of
  key. `KotlinVisibility.Public` names a value the program inspects.
- Prefer domain nouns and verbs over implementation roles like `Manager`,
  `Processor`, `Handler`, or `Util`.
- Use suffixes only when they disambiguate real alternatives: `Parser`,
  `Renderer`, `Repository`, `Factory`, `Policy`, `Adapter`.

## Expression Style

- Prefer `map`, `mapNotNull`, `flatMap`, `fold`, `associate`, `groupBy`,
  `partition`, `filter`, `takeIf`, and `let` when they state the transformation
  directly.
- Avoid function-scope `var`s and transient mutable collections for ordinary
  transformations.
- Keep mutation confined to builders, caches, interop adapters, or measured hot
  paths.
- Prefer small expression-bodied functions when the body is a single idea.
- Use local values only when they name a concept, avoid repetition, or make a
  branch easier to verify.

## Testing Themes

- Identify behavioral themes: valid parse, invalid parse, state transition,
  error classification, compatibility, ordering, idempotence, cancellation, or
  integration boundary.
- Add tracer bullets one behavior at a time.
- Tests should prove correctness through the public API. Do not chase coverage
  for code that has no independent behavior.
- Prefer a few tests that pin invariants over many tests that mirror
  implementation steps.
