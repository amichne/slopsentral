# Proof-Carrying Examples

Use this reference when extracting examples from a source repository or turning
those examples into durable reference material. An example is proof-carrying
only when another agent can tell where it came from, why it is useful, what it
requires, and how to prove it still works.

## Evidence Order

Prefer evidence in this order:

1. The target repository's config, generators, tests, docs contracts, and
   successful command output.
2. The upstream product's executable defaults, parser or schema, CLI source,
   and integration tests.
3. The upstream product's authored documentation source.
4. A related project's examples only when the active product documents or tests
   that compatibility boundary.

A rendered documentation page is useful for discovery, but it is weaker than
the source that generated it. A plausible Markdown block is not proof that the
target renderer transformed it.

## Extract from Source

Use the official repository and record the exact revision:

```bash
upstream=$(mktemp -d)
git clone --depth 1 "$repo_url" "$upstream/source"
git -C "$upstream/source" rev-parse HEAD
rg -n "$feature_pattern" "$upstream/source"
```

For each candidate:

1. Find the smallest complete example, including config prerequisites.
2. Trace the behavior into an executable default, parser, schema, or test when
   one exists.
3. Compare the candidate with the target repository's installed version and
   existing dialect.
4. Run the target repository's real build.
5. Inspect the generated page for a feature-specific DOM or output signal.

Do not silently repair an upstream example. Record the discrepancy, use the
form supported by executable source, and retain a rendered check that would
catch a regression.

## Evidence Card

Each durable example or recipe must answer all six fields:

- **Reader job**: the decision or task this example helps complete.
- **Provenance**: repository, revision, file path, and heading or symbol.
- **Prerequisites**: config keys, extensions, theme flags, files, and tool
  version constraints.
- **Minimal example**: only the syntax needed to teach the behavior.
- **Verification**: the command and observable rendered or CLI signal.
- **Caveat**: replacement semantics, generated boundaries, compatibility, or
  version drift that could make the example misleading.

Omit examples that cannot meet this bar. A short, proven catalog is more useful
than a broad syntax gallery.

## Render Proof

Before choosing flags, inspect the installed tool:

```bash
<tool> --version
<tool> build --help
```

Build from authored source, then inspect the specific output page rather than
searching a minified asset tree. Useful signals include transformed container
classes, generated metadata, resolved navigation links, and the absence of
literal control syntax where server-side transformation was expected. For a
client-transformed feature, serve the site and inspect a browser snapshot after
the page scripts run.

If the page intentionally teaches the control syntax inside a code fence, scope
the check to the rendered example rather than asserting that the token is absent
from the whole HTML file. Likewise, do not reject a client-transformed feature
only because its pre-runtime HTML still contains the source marker.

## Reference Maintenance

Record the upstream revision and review date near the source map. During a
refresh, re-run the extraction from the current official revision and keep only
claims that still agree with the live CLI and a clean build. This makes drift
visible without pretending a copied snippet is timeless.
