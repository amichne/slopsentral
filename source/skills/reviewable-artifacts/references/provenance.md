# Provenance and Adaptation

`reviewable-artifacts` is a local portable adaptation of Amp's official
`creating-artifacts` skill, cached as version `17d8ed06bb277c26` and exported in
`amp-builtin-skills`. It is not an official Amp skill or integration.

The input bundle's tree SHA-256 is
`7dd70b7deff6b8fcfdf959fdd215d570ea166d1926c9c29a115f4f2eb7946d3d`.
Original file SHA-256 values:

| Original file | SHA-256 |
| --- | --- |
| `SKILL.md` | `8a42de3aa56d73c2124214d7e19d292f3ac22fbcea4edbbffbb3f363663f9e36` |
| `scripts/share.mjs` | `3a0c1c21109a49c82664afcf0e0327cc602d4d515694e19bc7f86b77467071f3` |
| `reference/page-template.html` | `b3c35abbc93e126b143699caf0168f1e2a22824d490aa05e9415752f720b27fe` |

## Retained

The adaptation retains the inline-chat default, reader-first summary, grounded claims,
stable block ids and tags, visual-first explanations, before-and-after comparisons,
reduced-motion support, and revision workflow. The page template and HTML checker are
adapted from the original files; much of the writing and picture guidance retains the
original wording and examples, now in focused references.

## Changed

The local name distinguishes this adaptation from the upstream skill. The workflow no
longer depends on a sandbox, orb, portal, agent-specific directory, browser command, review
button, or comment-message format. File delivery works without hosting. The checker uses
`artifacts/pages` by default and never starts a service or makes network requests. An
explicit base URL only forms links for separately hosted files. Missing answers do not
authorize publication or other blocked work.

## Distribution Limit

The supplied upstream bundle contains no license or redistribution notice. These hashes
identify the inputs; they do not establish redistribution rights. This adaptation does
not assign an open-source license to the upstream text, code, or template. Confirm the
applicable upstream terms or obtain permission before publishing or redistributing these
adapted materials. No publication is part of this local change.
