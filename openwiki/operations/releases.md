---
type: Runtime Flow
title: Unified versions and tested-byte publication
description: Trace the shared product version from App-authored proposals through exact-head admission, saved candidate bytes, release downloads, and completion labels.
tags: [releases, provenance, candidates, publication]
sources:
  - id: openwiki-source-225cc86f67218ea21d10969d
    resource: repo://.github/workflows/publish-harnesses.yml
  - id: openwiki-source-dec39273f79c0bbf42ff7b2d
    resource: repo://.github/workflows/release-pi.yml
  - id: openwiki-source-46fa34397e41ebf7491c7359
    resource: repo://.github/workflows/release-please.yml
  - id: openwiki-source-482fa4ca84f42b04ba025fc1
    resource: repo://release-please-config.json
  - id: openwiki-source-59787f8ca71099e69424139a
    resource: repo://tools/publish.py
  - id: openwiki-source-2275f4e442b08ebc1ea468de
    resource: repo://tools/release_version.py
generated: { by: "codex", at: "2026-11-03T17:57:45.987Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-11-09T13:20:54.909Z
---

# Unified versions and tested-byte publication

`package.json` owns one Slopsentral product version.
Authored plugins, marketplace references, Python metadata, root lockfiles, and provider artifacts share that version.
Dependency pins and schema revisions remain independent.

## Propose one root version

[Release Please configuration](../../release-please-config.json) defines one root component with patch-only increments.
This is the repository's release policy. It does not assert semantic compatibility for every change.
Generated provider trees are excluded from direct version updates.
The [version owner](../../tools/release_version.py) rejects missing targets and mixed authored versions.

The [Release Please workflow](../../.github/workflows/release-please.yml) uses a repository-scoped GitHub App token for proposals.
It deliberately skips GitHub release creation.
A separate admission path permits only an App-authored version PR with the expected patch increment and allowed file set.
Both validation jobs must pass for that exact PR head.
Ordinary code PRs keep their normal merge process.

The [release guide](../../docs/releases.md#required-github-app-setup) describes the private App credentials and their scopes.
The built-in token is not a silent substitute for those credentials.

## Qualify bytes before publication

`Validate Source` projects and examines provider packages, installs the Pi archive, and keeps source-bound artifacts.
The candidate records bind revision, workflow run, producer attempt, version, archive bytes, and installer inventory.
The command bootstrap, Python command, and adjacent lock travel in the setup inventory beside the native Pi installer.

[Release Slopsentral](../../.github/workflows/release-pi.yml) selects a successful trusted main validation run with an unpublished shared version.
It admits the original Pi producer and exact provider and setup artifact attempts.
It examines source identity and digests before publication.
Publication consumes the same saved, tested package bytes directly.
A failed main run leaves the unpublished version pending for a later repaired main run.

## Publish without replacing history

The publisher creates the source tag without replacement.
It uploads all saved archives, receipts, installers, and digests to a draft release.
It examines actual downloaded draft assets before it makes the release current.
Conflicting tags or assets stop the operation.

After publication succeeds, the version-PR lifecycle changes from pending to tagged.
The PR must match the published version and belong to the released source history.
If only label completion fails, inspect downloads and retry that idempotent completion for the exact source.
Do not remove pending labels as a substitute for release evidence.

## Keep moving provider branches distinct

[Publish Harnesses](../../.github/workflows/publish-harnesses.yml) maintains `harness/codex`, `harness/github-copilot`, and `harness/amp`.
It also updates the Codex and Copilot generated trees on main.
Amp stays absent from main.
Those moving branches remain distinct from immutable GitHub release archives.

Use the [release recovery procedure](../../docs/releases.md#verification-and-recovery) after an interrupted operation.
The [version tests](../../tools/python_checks/test_release_version.py) and [asset tests](../../tools/python_checks/test_release_assets.py) exercise admission and digest rules.
Local checks do not establish configured credentials, a hosted successful run, or public downloads for a new release.
