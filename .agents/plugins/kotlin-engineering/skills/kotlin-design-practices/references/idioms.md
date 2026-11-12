# Kotlin Idioms

Use as a compact expression-style reminder.

Prefer expression-body functions. Read [expression flow](expression-flow.md) for scope selection and the prohibition of `?: return`.

Prefer `map`, `flatMap`, `fold`, `associate`, `groupBy`, `partition`, `filter`,
`let`, and sealed `when` when they state the data flow directly.

Keep nullable-producing idioms such as `takeIf` and nullable callbacks passed to
`mapNotNull` at the designated boundary. In core code, use `filter` for ordinary
collection selection and domain-named sealed alternatives when absence carries
meaning. Do not turn expected failures into null and silently discard them with
`mapNotNull`; preserve each failure through typed outcome composition.

Avoid transient `var`s, mutable accumulators, `apply` for non-configuration
work, and `also` chains that hide important side effects. Normalize platform
nullability at the boundary rather than introducing nullable core state.
