---
type: Integration
title: Explicit Codex profile transactions
description: Follow read-only planning, guarded overlay writes, hook review, and conflict-aware rollback without implicit repository activation.
tags: [profiles, codex, transactions, recovery]
verified:
  - by: openwiki/0.6.1
    at: 2026-11-03T17:57:45.987Z
sources:
  - id: openwiki-source-147465a296dca3f0beade8db
    resource: repo://tools/profile-lifecycle.mjs
generated: { by: "codex", at: "2026-11-03T17:57:45.987Z" }
---

# Explicit Codex profile transactions

Profiles select resources for a named Codex configuration.
The [lifecycle owner](../../tools/profile-lifecycle.mjs) materializes that selection only after an explicit operation.
A repository marker does not change user configuration.

## Plan the named configuration

`plan` and `status` inspect the host version, marketplace, installed Slopsentral plugins, and target overlay.
They return JSON without writes.
The lifecycle needs Codex CLI 0.134.0 or later.

```sh
node tools/profile-lifecycle.mjs plan --profile local-development-default
node tools/profile-lifecycle.mjs status --profile local-development-default
```

The [profile schema](../../source/schemas/profiles/workflow-profile.schema.json) closes the supported selection policies.
`PRESERVE`, `DISABLE_UNSELECTED`, and `REMOVE_UNSELECTED` describe unselected-plugin reconciliation.
Authored defaults disable unselected Slopsentral plugins in the overlay instead of uninstalling them.
Foreign marketplaces and plugins remain outside that reconciliation.

Standalone skills use `PRESENT`, `ABSENT`, or `PRESERVE` states.
A different existing skill directory is a conflict.
The retired repository `activation` field is rejected.

## Apply only an owned overlay

`apply` checks the target before external installation effects.
It rejects a preexisting unmanaged profile file unless the explicit replacement option admits that change.
The resulting overlay selects resources without changing the base user configuration.
An unchanged managed profile returns a no-op without another transaction.

Hook review derives from selected plugin manifests.
The result names `HOOK_REVIEW_REQUIRED` with the configured policy.
The tool does not write Codex's runtime-owned hook trust state.
If Codex adds `[hooks.state]` to a managed overlay, later lifecycle operations preserve that section byte-for-byte.
See [hook delivery](../architecture/hooks.md) for trust and consumption limits.

## Preserve preimages and interruption state

Before a file change, the lifecycle creates a unique backup directory and saves the preimage's bytes, length, mode, and digest.
A missing target uses an explicit absent-file case.
The transaction starts as `PREPARED_TRANSACTION` before the atomic target write.
It advances to `COMMITTED_TRANSACTION` after that write completes.

A prepared transaction can therefore describe an interrupted operation before or after the target changed.
Rollback examines the target against both recorded images.
If it finds the intended after-image, it completes the saved transition before it restores the preimage.
If it finds the original image, it reports that restoration already occurred.
A later unrelated edit produces `PROFILE_CONFLICT` without replacement.

Rollback creates another versioned transaction, so its own preimage supports a later reversal.
Transactions cover the TOML overlay.
Native marketplace effects and new standalone skill installations remain in effect.
The [profile guide](../../docs/profile-lifecycle.md) gives exact backup paths, rollback arguments, and exit statuses.
[Lifecycle tests](../../tools/tests/profile-lifecycle.test.mjs) exercise accepted operations, interruption states, and conflicts in disposable directories.
