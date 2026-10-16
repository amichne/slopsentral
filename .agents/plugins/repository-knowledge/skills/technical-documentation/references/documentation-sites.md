# Documentation sites

Use this reference for site structure, UI changes, or rendered behavior.
For a small prose edit, keep the existing page shape and use the normal prose
assessment. Do not turn it into a site audit.

## Reader path and fact ownership

Start from the reader's task. For a new-user path, connect value, prerequisites,
installation, connection, first useful result, interpretation of limits, and
recovery. Use only the stages the product needs. Show an expected result and
a recovery path near the step that can fail.

Keep procedures in Guides, mechanisms in Architecture or Explanation, and exact
interface facts in Reference when those tracks fit the site. These are roles,
not required navigation labels. Give each material fact one canonical owner
and cross-link other uses. Preserve generator and registry ownership.
Keep useful routes and heading anchors; review redirects before moving pages.

Keep prerequisites, critical warnings, result limits, and recovery visible.
Use progressive disclosure for optional depth. A reader must not need to open
an accordion or select every tab to discover a caveat that changes the next action.

## Resolve uncertain design choices

Read nearby pages and the product brief before choosing a pattern.
For a substantial redesign, or an uncertain style or interaction, inspect two
or three mentor documentation pages with comparable reader tasks.
Prefer the user's named mentors. Compare the relevant pages, not just homepages.

Record the URL, observation date, task, observed pattern, proposed adaptation,
and its reason. Examine layout or interaction in a browser when that is the
uncertainty; extracted text cannot establish visual behavior.
Use a bounded comparison, then build and inspect the local result.
Do not copy another product's claims, commands, branding, or unsupported UI.

Revisit current mentor pages before relying on them. Possible starting points:

- [uv first steps](https://docs.astral.sh/uv/getting-started/first-steps/) pairs
  a command with its expected result and next step.
- [Temporal Workflow Execution](https://docs.temporal.io/workflow-execution)
  explains mechanisms and state.
- [Stripe authentication](https://docs.stripe.com/api/authentication) places
  exact interface tokens beside prose.

[Diátaxis](https://diataxis.fr/) describes the reader needs behind these roles.

## Confirm framework support

Inspect local site configuration, navigation, dialect, component definitions,
generated content, and installed CLI version. Use the existing framework skill
and current official component documentation for unfamiliar signatures.
Prefer a supported built-in component that serves the reader's action.
Check Cards, Steps, Prompt, Tabs, or CodeGroup against their actual purpose;
do not add tabs where no meaningful choice exists.

For Mintlify, inspect `docs.json` and `.mintlify/product-brief.md` when present.
The [official React component constraints](https://www.mintlify.com/docs/customize/react-components)
exclude third-party npm imports in hosted MDX. A package installed for an asset
build does not make it importable in a hosted page. Use supported snippets or
pre-rendered assets as appropriate. Recheck current restrictions before a change.
Use the official [Mermaid](https://www.mintlify.com/docs/components/mermaid-diagrams)
and [Prompt](https://www.mintlify.com/docs/components/prompt) references for their
current APIs. A local substitute renderer does not establish hosted behavior.

## Check the rendered result

Run the repository's framework validation, broken-link check, and applicable
accessibility checks. Keep their output and known coverage limits.
Then follow the changed reader path in a preview of the candidate revision.
Record route, source revision, renderer version, viewport, theme, and observed
result. Mark a local preview separately from hosted deployment evidence.

- Inspect actual screenshots at desktop and a supported narrow width. Check
  hierarchy, wrapping, overflow, diagrams, and visible caveats. A saved screenshot
  that nobody inspected is not a visual check.
- Wait for client components to hydrate before testing interactions. Read full
  displayed prompt text, then click Copy and compare clipboard bytes with the
  authored request or command, including quotes, braces, escaping, and newlines.
  Repeat after navigation; a Copy button or success toast proves little alone.
- Use the keyboard through changed menus, tabs, disclosures, and copy controls.
  Check focus visibility, reading order, names, and access to diagram alternatives.
- Navigate between tracks or sections, dismiss the mobile menu, then repeat the
  path and use Back/Forward. Check overlays and state after the second navigation.
- Inspect each affected theme for contrast, missing assets, and legible diagrams.
  Check sanitizer effects in the embed, not only the standalone asset.

Repair issues at the owning page, component, asset, or configuration. Repeat the
affected checks on the final revision. Report build, links, accessibility,
rendered UI, clipboard, and comprehension as separate evidence.
If a preview, clipboard, or hosted renderer is unavailable, name that gap and
keep the checks that did run. Do not deploy to get evidence without authority.
