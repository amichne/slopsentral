# Engineering Baseline

Reduce uncertainty before composition. Represent a finite domain with an enum or a closed variant.
Parse external primitives into constrained domain values.
Consumers accept those values and keep the facts that they establish.

Each conditional predicate answers one yes-or-no question about a known value.
Keep parsing, membership, normalization, and comparison as separate operations.
A predicate returns true or false.
A refinement returns success with a stronger value or failure with a finite reason.
Neither operation hides external effects.

For example, parse a date before comparing it with another date.
Reject malformed input at the parser. Compare two date values in a pure predicate.
Do not combine string parsing, date construction, and range comparison in one guard.
Exhaustive case selection and traversal can handle several alternatives.
They do not need an artificial chain of binary questions.

Keep each operation as small as its invariant permits. Give that invariant one owner.
Keep unchecked construction private. Preserve closed failures through composition.
Handle every known case explicitly. Do not substitute casts, flags, or comments for enforced contracts.

Keep decisions pure. Supply file, network, clock, process, and mutable service effects through explicit adapters.
Use existing domain types, standard libraries, repository tools, and native host workflows before adding custom machinery.
The project owns its language and toolchain choices.

Before an implementation, inspect the current owner and callers.
Name one accepted input and the nearest rejected case.
Use compiler rejection, schema rejection, or a focused runtime assertion for the claimed invariant.
An absent tool or empty selection supplies no behavior evidence.
State what each result proves and which external effects remain unproved.
