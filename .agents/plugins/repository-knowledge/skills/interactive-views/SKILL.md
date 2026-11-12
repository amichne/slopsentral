---
name: interactive-views
description: "Create compact, self-contained HTML visualizations: charts, diagrams, changeable calculations, dashboards, and quick UI experiments. Use when asked to chart, plot, graph, visualize, diagram, explain a race or where time goes, show a calculation, mock up, prototype, sketch, or compare design directions. Delivers a local HTML file or uses a confirmed HTML-capable renderer; requires no particular agent UI, injected kit, build system, or dev server. Use ordinary Markdown for a few values and reviewable-artifacts for a durable review document."
---

# Interactive Views

A view answers a question by showing it. It is one compact visualization or UI experiment,
not a full document or an application. The reader should see its point before clicking.

A view is ordinary HTML, CSS, and JavaScript. Do not assume a special code-fence language,
injected theme, global chart library, sandbox, or inline rendering in chat. This skill ships
its own kit and can assemble a standalone file that opens in a browser without a network.

`<skill>` means this skill's installed directory, wherever the agent loaded it. Resolve that
path before using its bundled resources. Nothing depends on the repository or plugin layout.

## When to Use a View

Use one when seeing answers the question faster than reading:

- **Data:** a trend, ranking, distribution, or comparison across several values.
- **Systems:** architecture, flow, sequence, state machine, timeline, race, tree, commit graph,
  or a step-through explanation tied to source.
- **Derivations:** how a number is computed, with inputs the reader can change.
- **Design:** a component or screen mockup, interaction prototype, wireframe, or two or three
  directions compared on one named axis.

Use Markdown for a short list, a small table, or one or two numbers. A view adds nothing to a
code change summary; show the diff instead. Use a supported diagram format directly when it
already answers the question. Do not build an HTML file merely to replace a readable diagram.
For a proposal or report with several sections, stable review tags, or a revision history,
use reviewable-artifacts; its document can contain a view.

## The Standard

A view is calm, quiet, and precise. It has one point, legible in one second. Everything else
is neutral and smaller so that point stands out. Restraint is the style: when in doubt, remove.

Looking right is the easy part. Views fail more often because the chart does not show what
the title claims:

- **Write the takeaway first.** For a chart it becomes the title. For a diagram or mockup it
  chooses the state to open on.
- **Compute the claim from the embedded data.** Never quote an absent number or rest a title
  on a placeholder. A calculator's title follows the current state.
- **Choose the encoding the claim needs.** A multiple plots the multiple, a share draws the
  share, and "N% within X" draws cumulative share.
- **Make the default state show the point at 360px.** Open a stepper where the title becomes
  true, highlight the important path before interaction, and open a mockup on its deciding
  state. Screenshots and skimming readers see only that state.
- **Name the limits.** A muted subtitle or caption says what was measured, its scope, and how
  it could mislead: a partial period, biased source, synthetic example, or assumption.

## Workflow

1. **Ground the view.** Read the relevant data, source, and design constraints. Write the one
   takeaway sentence. Separate measured values from illustrative data and assumptions.
2. **Read the matching reference:**
   - [Charts](references/charts.md) for charts, distributions, calculations, matrices, tables,
     and dashboards.
   - [Diagrams](references/diagrams.md) for architecture, sequences, states, timelines, races,
     trees, commit graphs, and code explainers.
   - [UI explorations](references/ui-explorations.md) for mockups, prototypes, directions,
     experiments, and wireframes.
3. **Build from the closest source example.** Read [the kit](references/kit.md) when using
   `.ui-*` classes, tokens, icons, or `window.ui`. Read [visual design](references/visual-design.md)
   before styling. Copy only the example you need from `assets/examples/`, and replace its
   subject and synthetic data. Keep scripts in a block (`{ … }`) to avoid global-name clashes.
4. **Assemble a standalone file.** The examples are body fragments, not ready-to-open pages.
   With Node.js 22+ and no packages, inline the kit, icons, and light/dark tokens:

   ```text
   node <skill>/scripts/render.mjs /path/chart.source.html --out /path/chart.html --title "Queue latency fell"
   ```

   Create the output's parent directory with the available file tools first. Keep source and
   output separate. Existing output is preserved unless `--overwrite` is explicit; that flag
   updates the same delivery file after a revision. The renderer never starts a browser or
   server, uploads, or publishes. It accepts trusted body fragments up to 100,000 UTF-8 bytes;
   aggregate data first. The assembled file also includes the kit's bytes.
5. **Check before sending.** Use the checks below. A successful assembly proves neither the
   claim nor the rendering.
6. **Deliver for the actual environment.** Use a confirmed HTML-capable renderer only when it
   can run the complete file, including its inline kit and scripts. Otherwise give the local
   file through the harness's supported attachment or file-link mechanism, or give its path.
   A normal `html` code fence shows source, not a promised interactive view. Do not invent a
   hosted URL. Publish or change access only when authorized.

If Node.js is unavailable, write a complete HTML file directly with inline CSS, data, and
native SVG/DOM code; do not call `ui.*` unless you also inline its implementation. No tool
installation is required just to draw a view. If the reader cannot run HTML, provide a static
SVG/image when supported, or a concise diagram/table and the file. State which interactions
are unavailable. Do not silently replace a requested prototype with a screenshot.

## Check Before Sending

1. **Check the claim.** Find the computation behind every number in the title. Match the
   encoding to it. Confirm the deciding state and necessary labels are visible without hover.
2. **Check the source.** No external scripts, fonts, styles, images, or requests. Data and icons
   are inline. Each control is labelled and keyboard reachable. No viewport-height sizing or
   unnecessary internal scrolling. The renderer includes a restrictive resource policy, but
   it is not an HTML sanitizer or an isolation boundary for untrusted code.
3. **Look in a browser when available.** Use any available browser tool or local browser;
   no particular automation CLI is required. For custom SVG, long labels, many rows, or
   interactions, inspect at 720px and 360px in light and dark mode. Check console errors,
   overflow, overlap, clipped labels, reduced motion, and the main control by keyboard and
   pointer. Test the assembled file, not a specially injected preview.
4. **Critique it.** Is the point legible in one second? Does the encoding fit? Is there a card,
   legend, accent, or label that can go? Remove one more thing, then check again.

Report unavailable checks honestly. Do not call static assembly a browser pass or a synthetic
example a measured result. Browser access is optional for delivery, not evidence of a check
that did not run.

## Completion

The view opens with its point, works without injected host resources, and has an honest
caption. The delivered file is self-contained and the reader knows how to open it. Keep the
reply short; add only what the view does not say, plus delivery and verification limits.

For maintenance or redistribution, read [provenance](references/provenance.md). This is a local
portable adaptation, not an official integration with its upstream host.
