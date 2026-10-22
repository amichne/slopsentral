# Expression Flow

Prefer expression-body functions when each path produces the declared result.
Use an exhaustive `when` for finite alternatives or an `if` expression for one condition.
Keep public result types explicit.

## Local policy

- Prohibit `?: return`, including `return@label`. Keep the absent case in the result expression.
- Prohibit non-local returns from scope-function lambdas.
- Preserve evaluation order, smart casts, cancellation, resource cleanup, and transaction behavior during a rewrite.
- Use `value?.let { ... } ?: Missing` only when the successful result cannot be null.
- If null also means a successful result, use an explicit branch.
  Keep absence separate from a successful null result.
- Do not replace an Elvis return with `!!`, an unchecked cast, or a concealed exception.
- Keep block bodies when resource management or several effects need explicit statements.

An ordinary Elvis return exits its named function early.
An unlabeled return inside an inline lambda can exit the enclosing function.
The policy rejects both forms without treating them as the same language construct.

## Scope selection

| Function | Object access | Result | Local purpose |
| --- | --- | --- | --- |
| `let` | Named argument or `it` | Lambda result | Transform a value or handle a non-null input |
| `run` | Receiver `this` | Lambda result | Compute a result from receiver operations |
| `apply` | Receiver `this` | Original object | Configure a fresh object before it escapes |
| `also` | Named argument or `it` | Original object | Express a visible side effect at the adapter |

Non-extension `run` groups local statements into an expression without a receiver.
Keep `apply` mutation local to construction. Keep `also` effects outside pure decisions.
Do not use either function to discard a fallible operation's result.
Name lambda arguments when `it` obscures the owner.
Avoid nested scope functions and long chains that obscure receivers or results.
Use a direct call when a scope function adds no meaning.

## Source and synthesis

The [official scope-function guide](https://kotlinlang.org/docs/scope-functions.html) defines receivers, results, selection, and nesting risks.
This repository adds expression-body preference, the Elvis-return prohibition, and the effect restrictions.
These local restrictions are not claims that Kotlin rejects the syntax.
