# Projection compatibility fixtures

`projection-v1` contains selected generated Slopsentral files from the official
projeKtor v1.2.1 executable. The source baseline is reuse PR #62 commit
`33b2581eb6758bd39f2b51e4b6b517e79d402da7`, before the tooling redesign.
The files are compatibility evidence, not authored provider output or upstream
skills. Do not edit them to make a changed mapping pass.

The baseline comparison covered all 397 Codex and 403 GitHub Copilot files,
including payload bytes and executable modes. Only the lock's `sourceSha` was
excluded because the new canonical hash excludes local caches. All other lock
fields matched. See [projection qualification](../../../docs/pkl-projection.md).

These fixtures retain API manifests, agent adaptation, instruction indexes,
hook command adaptation, and Kotlin MCP delivery. The native projection tests
also compare complete repeated output and canonical skill payloads.
