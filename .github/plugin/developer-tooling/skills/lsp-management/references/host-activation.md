# Host Activation

## Discover the client

Identify the editor, agent host, remote container, or remote machine that runs the client.
Examine its documented server registration and extension lifecycle.
Read its installed version's schema before a configuration edit.
An agent tool connection and an editor's LSP client are separate integrations.
A plugin projection that contains this skill does not supply an LSP client.

If the host supplies no client, report that missing capability.
Use an existing supported editor integration when the task permits it.
Do not create a new client or adapter as an implicit setup step.

## Attach the workspace

1. Select the installation on the machine that runs the server process.
2. Configure the documented executable, argument array, transport, runtime environment, and initialization options.
3. Configure the requested language identifiers and file associations.
4. Select the project root through the host's documented root mechanism.
5. For a monorepo, preserve the distinct roots and their toolchains.
6. Start or restart only the selected integration through its documented mechanism.
7. Open a source file that belongs to the selected root.
8. Examine the client log or attachment status for the selected server and document.
9. Wait for the server's documented project-import or analysis stage before a semantic conclusion.

The LSP lifecycle starts with `initialize`, its response, and `initialized`.
Document synchronization and feature requests depend on the negotiated capabilities.
The host owns message framing, request identifiers, cancellation, and shutdown.
Do not send unframed JSON through a shell pipe and call it an LSP session.
Use the installed protocol version and the [LSP specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/).

## Prove useful activation

Use a small project with an independently known declaration and use site.
Choose an operation that the server advertises and the user needs.
For a definition request, compare the returned location with the fixture's known declaration.
For references, compare the returned sites with the fixture's authored uses.
Keep capability absence distinct from an empty result.
An empty diagnostics list alone does not establish readiness.

Use the host's real client for the diagnostic comparison.
Introduce a known syntax or type error only in a disposable fixture or an authorized file.
Save or synchronize the document as the client protocol needs.
Examine the expected diagnostic through the host's supported push or pull mechanism.
Correct the error and examine its removal after analysis.
Keep the source revision, document version, command, and returned evidence together.
Remove disposable files after the comparison.

If source writes fall outside the request, use a temporary project or report the missing diagnostic proof.
A temporary project proves that project only.
The target workspace still needs attachment and a useful request through its actual client.

## Diagnose the first failed stage

| Stage | Evidence to examine | Next action |
| --- | --- | --- |
| Installation | Package identity, executable, runtime, platform, and version | Repair the selected installation owner |
| Configuration | Host schema, accepted settings, argument array, environment, and transport | Correct the documented client configuration |
| Activation | Client attachment, initialization result, document language, and selected root | Repair the selected integration lifecycle |
| Project import | Toolchain selection, dependency resolution, project logs, and source roots | Repair the project model |
| Semantic request | Advertised capability, request result, document version, and known expected result | Diagnose that operation without a blanket readiness claim |

Keep bounded errors and stage evidence.
If the same failure repeats without a changed prerequisite, stop the retry loop.
Report the missing prerequisite and the next discriminating action.
If the task removes a standalone session, use `shutdown` and `exit` through its client.
Do not stop unrelated server processes.
