---
type: Application Contract
title: Literal greeting
description: The greeting function formats its input as literal text within one greeting sentence.
code_sources:
  - path: app/greeting.py
    symbols: [greeting]
---

# Literal greeting

The [greeting function](../app/greeting.py) returns `Hello, `, its input text, and a final period.
The executable example supplies `reader` and prints `Hello, reader.`.
Input text remains literal. The function starts no shell process and reads no environment variable.

The [independent examples](../app/greeting_examples.py) expect `Hello, Ada.` and `Hello, $HOME.`.
Those assertions establish formatting for their inputs.
They do not establish caller validation or external-host behavior.

The [development procedure](../handbook/development.md) connects source edits to behavior assertions and documentation review.
The [knowledge index](index.md) supplies conceptual navigation.
