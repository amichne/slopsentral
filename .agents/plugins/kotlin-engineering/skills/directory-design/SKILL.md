---
name: directory-design
description: "Use to organize or review a directory tree, choose which axis to group by first, or decide what belongs in a path or name."
---

# Directory Design

A file can have a subject, audience, format, and owner at the same time.
Each axis answers a different question about that file. A path presents the answers in one order.
At each level, ask what the reader knows before they open a file.

## Choose the next directory

1. List the reader's tasks. Include a new item that has no filename yet.
2. Find candidate groups among direct siblings. Repeated words, shared callers, and files that change together can suggest a group.
   For a repeatable scan, split filenames at word separators or case changes. Compare the words without regard to case.
   Shortlist three or more peers with the same first word or first two words.
   Record the cutoff and inspect the members. Related files can have different names.
3. Sketch two orders for the same files. Give sibling directories names that answer the same question.
4. For each task, count the child directories the reader must inspect under each order. Mark tasks with no predictable destination.
   Prefer the order that narrows frequent or critical tasks and keeps one home for each item.
5. Try a task that enters the proposed child and a task that skips it. Place the new item before naming it.
   Add another axis inside that child only if it narrows a further choice. If both orders serve the tasks equally well, keep the simpler tree.

For example, a documentation tree serves operators and developers of both search and billing.
If a product owner revises both billing guides together, `billing/` gives that task one destination.
If operators need one handbook across products, `operators/` gives them one destination.
The files stay the same. The task determines which distinction belongs first.
An index can serve the other route without a second copy of each guide.

## Decide what belongs in the name

Let the path carry context that the reader already chose. Keep the qualifier a caller needs when a name appears outside that path.
Omit words such as `Public` or `Internal` when they only repeat a declaration's access.
Keep words that carry domain meaning, such as `PublicKey`. Preserve names that a language or tool uses to enforce a contract.
For example, Go enforces an import restriction on an `internal/` directory.
