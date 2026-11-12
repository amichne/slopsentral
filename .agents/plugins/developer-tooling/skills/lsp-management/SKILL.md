---
name: "lsp-management"
description: "Install, configure, activate, or repair Language Server Protocol support for a requested language and editor or agent host. Use for server selection, workspace attachment, missing diagnostics, and semantic-tool setup."
---

# LSP Management

Make a supported language server useful in the requested workspace and host.
Keep installation, configuration, activation, and semantic results as separate facts.

## Scope

Use this skill for LSP lifecycle work across languages with a compatible server.
A server entry in a catalog does not prove host support or project compatibility.
Use the existing language skill for compiler policy and project conventions.
For Python, preserve `python-tooling` and its uv environment.
For Pkl, preserve `pkl-engineering` and its editor-specific installation procedure.
For ordinary source edits with a useful semantic tool, use that tool directly.

## Procedure

1. Identify the requested language, project root, host version, operating system, and installation scope.
2. Examine existing server registrations, executable paths, package locks, toolchain versions, and host logs.
3. Identify the first missing stage: installation, configuration, activation, project import, or semantic request.
4. Read [server selection](references/server-selection.md) for installation sources and language-specific prerequisites.
5. Read the selected server and host documentation for their current compatibility and configuration contracts.
6. Reuse a compatible installation before another package or server registration.
7. If installation forms part of the request, install through the existing project toolchain or documented editor integration.
8. Record the selected package, version, source, executable, runtime, and destination.
9. Read [host activation](references/host-activation.md) before a registration or activation change.
10. Configure the exact executable, argument array, transport, environment, file types, project roots, and documented initialization options.
11. Start the client through its supported activation mechanism.
12. Open a source file within the requested project root.
13. Examine attachment and a real semantic response through that client.
14. Compare a controlled diagnostic with a corrected case in a disposable project or an authorized source file.
15. Report the completed stages, exact commands, changed configuration, semantic evidence, and unresolved limits.

## Installation Rules

Obey repository toolchain pins and operating-system support.
Prefer the documented editor integration when it owns the server lifecycle.
For standalone servers, use the server maintainer's documented package or release.
Make project and user installation scopes explicit.
Keep unrelated servers and configuration entries intact.
Do not treat this skill's presence as authority to install every listed server.
Do not invent a host configuration key, extension API, or tool connection.
If the host lacks LSP support, report that limit before a host configuration change.
Do not expose protocol traffic on stdout through wrapper logs.

## Completion

Installation succeeds when the selected artifact and runtime exist at the recorded paths.
Configuration succeeds when the host accepts its documented configuration.
Activation succeeds when the client attaches to the target document and completes initialization.
Semantic readiness needs a request with an independently known result in that workspace.
Keep unrun stages explicit.
A process, version command, registration, or successful handshake alone does not prove semantic readiness.

For a failed stage, preserve its error and the smallest useful log excerpt.
Stop at an unsupported host, incompatible toolchain, or unresolved server choice.
State the missing prerequisite instead of a successful activation claim.
