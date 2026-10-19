# Documentation evidence

The local change restores the Mintlify site and adds current Pi guidance.
The public Pi guide derives from `docs/pi-harness.md` through `tools/sync_docs.py`.
The generator keeps fenced examples and converts repository links for the public site.

## Results

- Passed: `npm ci --ignore-scripts` under Node.js 24.21.0.
- Passed: `npm run docs:check`, including stale-output rejection, Mintlify build assessment, internal links, anchors, and redirects.
- Passed: a temporary copy with one missing internal link returned exit 1 for that link.
- Passed: four generator cases under pytest.
- Passed: Ruff and strict Pyright through `tools/check.py`.
- Passed: 150 Python cases with the explicit Vale 3.24.0 executable.
- Skipped: 18 existing installer cases that need `TEST_VALE_ARCHIVE`.
- Passed: `actionlint` for both new workflows and `git diff --check`.
- Passed: browser-harness rendered all 17 routes with expected headings and images.
- Passed: desktop tabs, installation navigation, and the mobile menu at 390 pixels.
- Passed: the browser found no page-level horizontal overflow.

The first generator run failed the intended repository-link assertion.
The same command passed after link conversion.
The first complete Python run used an unresolved Vale shim and failed 15 assessment cases.
The explicit engine path resolved that environment failure.
The browser helper initially selected a hidden card with a zero-size rectangle.
The corrected helper rejects zero-size rectangles.
Chrome needed foreground access to finish the mobile menu transition in a hidden tab.

## Prose assessment

`text-assessment.json` records an `ASSESSED` result with visible findings and input hashes.
`assessment-disposition.json` records the rule, location, and reason for each remaining finding.
Domain terms and exact contracts keep their source names despite grade advisories.
The two other findings concern inherited instructions in `AGENTS.md`.
Reader comprehension remains `NOT_ASSESSED`.

## Delivery limits

The browser results describe the local preview.
`live-baseline.json` records the public installation page before these changes.
That page lacks Pi installation instructions.

The original documentation PR is closed.
Mintlify still reads `feature/slopsentral-docs`, so changes on `main` cannot update that deployment yet.
The Mintlify plan rejects workflow access because it lacks WORKFLOWS.
GitHub also keeps bot-created PRs off in repository settings.

`draft-doc-updates.yml` configures a source-derived Pi guide draft and an explicit assessment dispatch.
It does not infer documentation changes from arbitrary source code.
The hosted workflow did not run, and no branch, PR, setting, or deployment changed remotely.
Local search and installation commands were not run through the browser.

After separate delivery approval, publish the branch through a PR and enable bot-created PRs.
After merge, change Mintlify's source branch to `main` and examine the public routes again.
