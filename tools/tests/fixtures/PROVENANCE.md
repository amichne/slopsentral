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
