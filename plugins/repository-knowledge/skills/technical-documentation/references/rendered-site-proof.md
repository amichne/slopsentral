# Rendered And Published Site Proof

Use this for rendered navigation, diagrams, layout, or a request to compare the
published site with a local revision. A small prose edit does not require a
browser or deployment check merely because the repository contains a site.

## Establish The Two Sides

Name the local source revision and configuration, build output, expected page
and navigation entry, and the requested published URL. Inspect the framework's
actual source and navigation owners. Confirm deployment identity from available
build or revision metadata; when it is unavailable, state that limit.

Keep publication authority separate. Comparing a remote site does not authorize
pushing, redeploying, changing access, or migrating the site framework.

## Inspect What The Reader Sees

Run the relevant local validator and link check. For visual changes, open the
preview in an available browser, follow the changed navigation, and inspect the
page and diagram. Check the affected narrow layout when responsive behavior is
part of the change. Capturing a screenshot without inspecting it proves little.

For a published-match request, open the requested remote pages too. Compare the
same distinctive content, navigation, links, and rendered contract with the
local result. An HTTP 200, a successful local build, or an open preview URL does
not prove that the published site contains the revision.

When the sides differ, distinguish observed differences from possible causes:
wrong source root, stale deployment, missing navigation, configuration loss,
or caching. Inspect the owning configuration or deployment evidence before
choosing one. Do not patch generated pages to hide a generator defect.

## Report

Give the destinations and source/deployment identities that were established,
the specific matching and differing states, checks actually run, and remaining
gaps. Label an uninspected rendering or unidentified deployment as unverified.
Keep evidence in the existing report or handoff; do not create a separate site
or publication workflow just to record a comparison.
