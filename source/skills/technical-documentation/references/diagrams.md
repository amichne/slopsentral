# Source-backed diagrams

Use a diagram when it answers a reader question about responsibility, state,
sequence, dependency, or data. Name that question and the source owners first.
Keep one bounded subject per diagram and explain its meaning beside it.

## Preserve meaning

Keep authored Mermaid or other editable source in the repository. For recovered
material, preserve the exact original with its origin, page ID, and source
revision when known. Keep corrected source and rendered output separate.
Record syntax repairs, semantic corrections, and styling changes separately.

Check nodes, labels, directed edges, ordering, failure and partial-result
branches, and authority boundaries against current source. A simpler picture
must preserve the properties it claims to explain. Do not turn a partial result
into success or delete an unsupported edge silently to get a render.

For a conversion, map the original elements to the result. If the renderer does
not support the syntax, keep the original and choose a supported native
renderer, split the view, or disclose the unconverted portion.
Do not present a lossy conversion as faithful recovery.

## Render and inspect

Use the repository's existing renderer and pinned dependencies. Verify the
current supported syntax and integration before adding a renderer.
For hosted MDX, render third-party diagram packages during the build when
runtime imports are unsupported. Keep the rendering command reproducible.

Keep parse failures with page and diagram identity. Inspect generated SVG for
malformed XML, missing labels, external font or asset dependencies, and content
that the target sanitizer can remove. Validate according to the host's policy;
an XML parse alone does not establish browser compatibility.

Inspect the diagram inside the actual page after hydration at desktop and narrow
widths, and in each affected theme. Read every label and branch; check clipping,
contrast, scaling, and captions. Compare it with the authored source.
An image file that renders alone can still be empty or illegible in the site.

Provide an adjacent text explanation and descriptive accessible name.
For a dense image, offer a visible full-size or source link. Critical meaning
must remain available without hovering, zooming, or opening an accordion.
Repeat the rendered check after an asset or embedding change.

Report original sources, corrected sources, successful parses, failures, and
visually inspected embeds separately. Identify unavailable browser or hosted
evidence instead of calling a local build a complete rendering check.
