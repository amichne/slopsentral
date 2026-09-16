# Document Contracts

A README starts with purpose and the shortest verified entrypoint. A how-to names
prerequisites, steps, expected results, and relevant failures. A reference states
an authoritative interface. A concept explains one idea. Do not mix all four
forms merely to fill headings.

An architecture decision records status, context, decision, consequences, and
links to superseding decisions. Preserve historical decisions; do not silently
rewrite a past choice as though it had always been the current one.

A runbook starts from an observable symptom, then gives evidence to collect,
bounded diagnosis, authorized recovery, verification, and escalation. Destructive
steps require a concrete target and explicit authorization. A generic rollback
command is unsafe when the data model has moved forward.

For changed exports, defaults, commands, and error states, find affected docs and
examples. A string match is a coverage lead, not proof of semantic correctness.
A documentation build proves rendering and selected checks, not truth of claims.

Use code blocks with the actual language. Verify examples in a disposable fixture
when possible. Keep placeholders unmistakable and do not invent successful output.
Use diagrams only when their supported renderer and their subject improve clarity.
