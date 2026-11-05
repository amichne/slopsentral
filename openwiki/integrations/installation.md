---
type: Integration
title: Consumer installation and recovery
description: Separate the native Pi bootstrap from general host management, then trace qualification, preserved state, and guarded recovery.
tags:
  - installation
  - pi
  - amp
  - recovery
  - consumers
sources:
  - id: openwiki-source-59e94a76c36256a0ceee4f2d
    resource: repo://source/hooks/pi/adapter.ts
  - id: openwiki-source-965e21463a3abc211c0d505e
    resource: repo://tools/install-pi.sh
  - id: openwiki-source-fc855c6faec3d10981287a01
    resource: repo://tools/projection/Amp.pkl
  - id: openwiki-source-755a3cefcf633172d98cf969
    resource: repo://tools/setup-pi.mts
  - id: openwiki-source-694f90ac01e419c575288a8d
    resource: repo://tools/slopsentral.py
generated: { by: "codex", at: "2026-11-04T15:10:06.076Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-11-05T15:45:23.454Z
---

# Consumer installation and recovery

Consumers install qualified release bytes or native marketplace packages.
They do not need the projector's complete maintainer toolchain.
The [general command](cli.md) owns explicit host operations. The separate Pi bootstrap preserves its original entry point and recovery path.

## Install Pi through the native bootstrap

The [launcher](../../tools/install-pi.sh) needs macOS or Linux and Node.js 22.19 or later.
It selects a stable release, examines the installer asset's origin, size, and digest, and delegates to those bytes.
Consumer setup needs no checkout, npm installation, system Python, uv, or Pkl.

The [setup owner](../../tools/setup-pi.mts) qualifies the release tag, source identity, successful main run, archive digests, and receipts before configuration changes.
Its archive contains the aggregate native package for all catalog plugins.
Skills use native discovery. Agent procedures become native review prompts.
The package also includes the selected instruction and hook adapters.
The retired single-skill package does not describe the current release path.

Setup preserves unrelated settings and migrates recognized Slopsentral registrations.
It rejects ambiguous legacy extensions, edited installed bytes, foreign paths, and concurrent configuration changes.
The host keeps its native trust decision.
Installation does not prove every feature in an older Pi host.

## Keep setup and hook dependencies distinct

After release qualification, the bootstrap prepares a private CPython 3.12.14 before activating new configuration.
The shared runtime lives under `~/.pi/slopsentral-hook-runtime`, including for project-scoped installations.
Project files cannot choose that interpreter.
It verifies a pinned uv 0.12.9 archive, uses that setup tool to install Python, and removes the tool afterward.
Setup needs network access and keeps TLS verification enabled.
The mapped runtime targets are macOS and Linux with glibc on arm64 and x64.

Managed hook processes invoke the private interpreter directly.
They need neither system Python nor uv, and invocation needs no network access.
The runtime receipt binds the platform, relative executable path, and interpreter digest.
Repeat setup verifies that receipt and the interpreter's required standard-library imports.
Missing or changed runtime files produce explicit failures.
A context failure blocks tool calls until a later request succeeds.
The [hook lifecycle](../architecture/hooks.md) explains admission and the one-turn repair limit.

Direct native package installation bypasses runtime provisioning and retains the external uv requirement.
The private interpreter supports the current hooks' empty third-party dependency lists.
A different dependency contract requires an explicit runtime update rather than silently omitting dependencies.

Pi's `/hooks` controls persist Slopsentral hook choices separately from package installation.
The maintainer dependency pins a host for executable evidence.
Consumer setup uses the installed host best-effort instead of enforcing that exact version.

## Update and recover the selected scope

Personal scope uses Pi's global instruction directory by default.
The native bootstrap also supports explicit project scope and a named stable release.
The [Pi guide](../../docs/pi-install.md#scope-updates-and-recovery) gives exact arguments.

Setup records private preimages before its writes.
Repeating a current installation returns `CURRENT`.
Rollback needs the original project directory and scope.
It rejects later edits with `CONFIG_CHANGED` and preserves those files for manual recovery.
Rollback still qualifies the release, but does not need Pi or tar and never executes project-cached recovery code.

Removal uses the same recoverable transaction owner.
It preserves unrelated settings, installed payloads, and private recovery records.
The general command removes only its personal-scope registrations.

## Install Amp as complete packages

The general command places managed links under Amp's system plugin directory.
It compares installed bytes with the cached release before replacement or removal and preserves foreign paths.
Manual project installation uses complete projected bundles, including skills, scripts, references, and instructions.
Never copy only `index.js`.

Amp supports native skill discovery and turn-start instructions.
Referenced hooks, agents, and MCP configuration do not become active integrations.
Profiles are unsupported.
Use the [projection guide](../../docs/pkl-projection.md#amp-native-plugins) for capability and manual recovery details.
[Native installation tests](../../tools/tests/pi-install.test.mjs) and [setup tests](../../tools/tests/pi-setup.test.mjs) exercise real package paths without model calls.
