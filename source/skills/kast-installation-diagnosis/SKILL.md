---
name: "kast-installation-diagnosis"
description: "Use when diagnosing a Kast installation, workspace authority, runtime, plugin, or configuration mismatch, including stale binaries, receipts, backend readiness, typed setup failures, or post-install verification; not for routine Kotlin or Gradle queries."
---

# Kast Installation Diagnosis

Treat the live installation as versioned state. Discover its public and operator
interfaces before using commands remembered from another release.

Diagnosis is read-only by default. A repair request authorizes only the
smallest supported mutation that owns the observed failure.

## Workflow

1. Canonicalize the exact workspace root and preserve the complete failing
   command, exit status, stdout, and stderr.
2. Record `command -v kast`, `kast --version`, `kast --help`, the active
   release receipt, and existing workspace metadata. The public binary is the
   agent interface.
3. For installation or runtime diagnosis, discover the matching local control
   binary and verify its version and help before using it.
4. If workspace reconciliation is authorized, inspect effective configuration,
   exact-root status, and task readiness. Keep typed failures intact.
5. Classify the first broken boundary: executable selection, release authority,
   workspace metadata, backend lifecycle, indexing, or semantic capability.
6. If repair is requested, use only a command exposed by the live public or
   control help, installer, or returned `next` instructions. Capture before and
   after state.
7. Re-run the original failure and a public readiness or semantic check. A
   running process without exact-root readiness is not a successful repair.

## Boundaries

- Never hand-edit release pointers, receipts, workspace metadata, sockets, or
  index databases.
- Root-bound public and control commands may reconcile or migrate legacy
  workspace state. Treat them as mutations; passive diagnosis stops at existing
  receipt and metadata inspection.
- Never start a second IDE merely because the selected IDEA backend is stale.
- Do not substitute Graphify for missing Kotlin or Gradle evidence.
- Use the version-bound Kast query or change skill after readiness succeeds.
- Route comparative timing, telemetry, traces, and JFR work to
  `kast-performance-assessment`.

## Reference Routing

Read [operator-runbook.md](references/operator-runbook.md) for the command
sequence, failure classification, supported mutation rules, and debug
instrumentation handoff.

## Completion Criteria

- Evidence identifies the exact root, binary, version, and release authority,
  plus the selected backend when workspace reconciliation was in scope.
- The first failing boundary and owning repair are explicit.
- Any mutation has before/after evidence and uses a supported owner.
- The original operation succeeds, or the remaining typed blocker is reported
  without a workaround.
