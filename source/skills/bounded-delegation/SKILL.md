---
name: bounded-delegation
description: "Use when a task can benefit from independent parallel investigation, implementation, or review with explicit ownership and an evidence-based handoff."
---

# Bounded Delegation

Delegate an independently verifiable result, with one owner for each changed
surface. Use available collaboration tools only; perform the work directly when
no such capability exists or coordination would cost more than it saves.

## Workflow

1. Identify independent questions or edit sets. Keep coupled design decisions and
   a single shared mutable file with one owner until their interface is settled.
2. Give each worker the goal, input sources, allowed files and effects, expected
   artifact, verification, and stop condition. Do not send the whole session when
   a small evidence packet suffices.
3. Assign non-overlapping writes or isolated worktrees. Read-only reviews may
   overlap deliberately. Keep authorization unchanged across delegation.
4. Continue independent work. Do not duplicate an assigned task unless the worker
   fails, the scope changes, or independent review is the stated objective.
5. At handoff, inspect the actual diff and evidence. Resolve conflicts centrally,
   validate combined behavior, and report unresolved findings without erasing them.

## Completion Criteria

Each result has an owner, a bounded artifact, and inspectable verification. The
integrated result passes required checks. A worker's confidence or completion
message alone is not evidence of correctness.
