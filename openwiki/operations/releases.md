---
type: operations
title: Versioning and tested-byte releases
description: Trace the shared product version from validation and retained artifacts to immutable releases, separate harness publication, and Release Please proposals.
tags: [releases, validation, provenance, publication]
sources:
  - id: openwiki-source-225cc86f67218ea21d10969d
    resource: repo://.github/workflows/publish-harnesses.yml
  - id: openwiki-source-dec39273f79c0bbf42ff7b2d
    resource: repo://.github/workflows/release-pi.yml
  - id: openwiki-source-46fa34397e41ebf7491c7359
    resource: repo://.github/workflows/release-please.yml
  - id: openwiki-source-2a773b8dcd244b49fcf7a60f
    resource: repo://docs/pkl-projection.md
  - id: openwiki-source-850ce4df05017c059ef1c57e
    resource: repo://docs/releases.md
  - id: openwiki-source-482fa4ca84f42b04ba025fc1
    resource: repo://release-please-config.json
  - id: openwiki-source-2275f4e442b08ebc1ea468de
    resource: repo://tools/release_version.py
generated: { by: "amp", at: "2026-10-26T01:58:25.745Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-10-26T01:58:25.745Z
---

# Versioning and tested-byte releases

Slopsentral has one product version, owned by `package.json`. Provider releases
and authored plugins share it; dependency pins and schema revisions do not.
Changing source, generating packages, publishing harness branches, and creating
a release are different operations.

## Version changes are authored together

`release-please-config.json` defines one root component with patch-only
increments. It synchronizes the npm manifest and lock, Python metadata and
lock, plugin manifests, marketplace plugin versions, and the release manifest.
Generated trees are not direct version-update targets.

This patch-only policy is a release convention, not proof that every change
is semantically patch-compatible. New plugin manifests must join the configured
update set. `npm run check:release` rejects mixed versions and missing targets.

## Validation produces evidence before publication

```text
Main source revision
  → Validate Source: tests and retained candidates
  → Release Slopsentral: admit successful run and version increment
  → verify retained Pi, provider, and setup bytes
  → source tag and draft release
  → verify actual downloads
  → make release current and finalize Release Please labels
```

`Validate Source` projects and tests packages, including Pi native discovery,
archive installation, setup, and recovery. It retains candidates tied to the
source. `Release Slopsentral`, implemented in `release-pi.yml`, selects only a
successful main validation run with a shared-version increment. Ordinary main
commits without an increment do not create a release.

The publisher admits artifact producer attempts, checks version and source
identity, and verifies archive digests and installer receipts. It publishes the
retained bytes rather than rebuilding them. It creates a source tag without
replacement, uploads a draft under `slopsentral-vX.Y.Z`, downloads the assets,
and compares their bytes and checksums before making the release current.

## Release Please proposes; humans merge

After the publisher succeeds, `Release Please` uses a repository-scoped GitHub
App token to propose the version and changelog PR. Its action has
`skip-github-release: true`; it does not publish packages or releases. App
credentials are separate from the publisher's job token. The
[release runbook](../../docs/releases.md#required-github-app-setup) documents
their required names and permissions; do not infer that credentials exist.

Only successful publication changes the merged release PR from
`autorelease: pending` to `autorelease: tagged`. If label finalization fails
after publication, verify the published downloads before retrying that exact
idempotent finalization. Removing a pending label does not verify a release.

## Harness publication is a separate path

`Publish Harnesses` validates source and updates `harness/codex`,
`harness/github-copilot`, and `harness/amp`. It also publishes the Codex and
Copilot generated trees to `main` together. Amp stays off `main`, so an authored
checkout does not load every bundle. Moving branches are not immutable
release archives; record the revision when installing from a branch.

## Failures do not authorize replacement

An interrupted publication can leave a source tag or draft release. Inspect
that state before retrying; never overwrite a conflicting version or replace
old assets. The [release runbook](../../docs/releases.md#verification-and-recovery)
contains focused checks. Use the [authoring workflow](../workflows/authoring.md)
for source validation and [installation guidance](../integrations/installation.md)
for consumer checks. Passing those checks alone does not authorize publication.
