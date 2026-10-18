# Projection compatibility fixtures

The projection tests keep two historical sources distinct from the current catalog.
They run the current projector against each pinned source and compare the matching expected provider bytes.
Historical fixtures use their original source validator because current policy rejects their old hook commands.
Current-source tests use the current validator.

| Proof | Source revision | Fixture revision |
| --- | --- | --- |
| Original projeKtor v1.2.1 compatibility | `33b2581eb6758bd39f2b51e4b6b517e79d402da7` | `c1409b05191c20e110e978844e8919bf6a4b9e25` |
| uv provider regression | `774716ce2cdee28133d463ae865f4c67bef68fb4` | `774716ce2cdee28133d463ae865f4c67bef68fb4` |

The uv foundation changed the fixture versions and hook commands without an update to the previous provenance text.
The checked-in `projection-v1` files now represent that uv revision.
They remain unchanged during the Kotlin-focused consolidation.
The test compares their bytes and modes against that exact Git revision.
It gets the original compatibility fixtures from their creation revision.

Both comparisons need the pinned Git objects. CI fetches complete history for these tests.
Missing history fails the test instead of silently skipping the comparison.
The historical evidence does not establish current host behavior.

Current-source tests separately examine complete deterministic output, canonical payload bytes, executable modes, and Codex lock digests.
The catalog can change without replacing historical evidence with regenerated expectations.

## Pi terminal evidence

`pi-virtual-terminal.ts` is an unchanged upstream test helper from Pi 1.3.0.
Its source revision is `71023aec1546d6d677a65669c5665c0927ce0dd0`.
The [original helper](https://github.com/earendil-works/pi/blob/71023aec1546d6d677a65669c5665c0927ce0dd0/packages/tui/test/virtual-terminal.ts) uses `@xterm/headless` to interpret terminal output.
The [upstream settings tests](https://github.com/earendil-works/pi/blob/71023aec1546d6d677a65669c5665c0927ce0dd0/packages/tui/test/settings-list.test.ts) supply the method.
This helper is test infrastructure, not a public Pi API.
Its relative type import remains unchanged and disappears during TypeScript transpilation.
The production menu uses Pi's exported components and lifecycle APIs.

`pi-LICENSE` preserves the upstream MIT license without edits.
Direct comparison with that revision established byte equality for both files.

| File | SHA-256 |
| --- | --- |
| `pi-virtual-terminal.ts` | `8ab8cf042a2157ac17717763bf7bf78a3147c8b14149a357a4b9081f322b8c31` |
| `pi-LICENSE` | `0457f5bcec3b3b211605dfb5d1a49042fd638f3686a410fe099c24a25af13c48` |

The Node lockfile resolves Pi 1.3.0 and `@xterm/headless` 6.0.0 for these cases.
Unpinned Pi ranges permit later installations, whose behavior needs separate evidence.
